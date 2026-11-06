import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { DatabaseService } from '../services/DatabaseService';
import { GeminiService } from '../services/GeminiService';

export class ChatController {
  /**
   * GET /api/chat/conversations
   * Lists all past conversation threads for the user.
   */
  public static async listConversations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId;
      const conversations = await DatabaseService.query(
        'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
        [userId]
      );
      res.json(conversations);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/chat/conversations
   * Creates a new conversation thread.
   */
  public static async createConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { title, model } = req.body;
      
      const id = crypto.randomUUID();
      const finalTitle = title || 'New Conversation';
      const finalModel = model || 'gemini-3.5-flash';

      await DatabaseService.query(
        'INSERT INTO conversations (id, user_id, title, model) VALUES ($1, $2, $3, $4)',
        [id, userId, finalTitle, finalModel]
      );

      res.status(201).json({ id, title: finalTitle, model: finalModel });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/chat/conversations/:id/messages
   * Lists all messages within a conversation.
   */
  public static async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // Being logged in is not enough: the conversation must belong to this user.
      const conversation = await DatabaseService.queryOne(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found or access denied.' });
      }

      const messages = await DatabaseService.query(
        'SELECT id, role, content, metadata, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
        [id]
      );
      
      res.json(messages);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/chat/conversations/:id
   * Deletes a conversation thread and its messages.
   */
  public static async deleteConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const conversation = await DatabaseService.queryOne(
        'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found or access denied.' });
      }

      await DatabaseService.query(
        'DELETE FROM conversations WHERE id = $1',
        [id]
      );

      res.json({ success: true, message: 'Conversation deleted successfully.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/chat/messages
   * Receives user message, runs AI tools, and streams the output using SSE (Server-Sent Events).
   */
  public static async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { message, model } = req.body;
      let { conversationId } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message body is required' });
      }

      // If no conversationId is passed, create a new conversation
      if (!conversationId) {
        conversationId = crypto.randomUUID();
        const snippet = message.substring(0, 30) + (message.length > 30 ? '...' : '');
        await DatabaseService.query(
          'INSERT INTO conversations (id, user_id, title, model) VALUES ($1, $2, $3, $4)',
          [conversationId, userId, snippet, model || 'gemini-3.5-flash']
        );
      } else {
        // Verify conversation ownership
        const convo = await DatabaseService.queryOne(
          'SELECT id FROM conversations WHERE id = $1 AND user_id = $2',
          [conversationId, userId]
        );
        if (!convo) {
          return res.status(404).json({ error: 'Conversation not found' });
        }
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders(); // Establish SSE connection immediately

      // Update conversation timestamp
      await DatabaseService.query(
        'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [conversationId]
      );

      // Start streaming response
      await GeminiService.chatAndStream(
        userId,
        conversationId,
        message,
        model || 'gemini-3.5-flash',
        (eventData) => {
          res.write(eventData);
        }
      );

      res.end();

    } catch (err) {
      // In SSE, headers are already sent, so we handle writing the error directly
      console.error('Chat stream exception:', err);
      res.write(`data: ${JSON.stringify({ type: 'error', message: (err as Error).message })}\n\n`);
      res.end();
    }
  }
}
