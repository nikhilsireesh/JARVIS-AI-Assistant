import { GoogleGenAI, Content, Part, FunctionCall } from '@google/genai';
import { workspaceDeclarations, handleToolCall } from '../tools/workspaceTools';
import { DatabaseService } from './DatabaseService';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error('Missing GEMINI_API_KEY in .env');
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Upper bound on model -> tool -> model round trips per user message
const MAX_TOOL_ROUNDS = 8;

const buildSystemPrompt = (): string => `You are JARVIS AI (Just A Rather Very Intelligent System), a premium, futuristic personal AI assistant created by Tony Stark.
You have secure, direct access to the user's Google Workspace (Gmail, Calendar, and Sheets) via built-in tools.
Your tone should be:
- Exceptionally polite, professional, and slightly futuristic (e.g., address the user as "Sir" or "Ma'am" depending on their preference, defaulting to "Sir").
- Minimal, clean, and highly efficient. Avoid fluff.
- Always report actions you are taking (e.g., "Accessing your inbox to compile a summary, Sir.").

Important operation rules:
1. When asked to check emails, use the \`read_emails\` tool. Summarize them concisely, highlighting critical or unread messages first.
2. When scheduling, use \`create_calendar_event\`. If the user gives a relative date like "tomorrow at 4 PM", calculate the exact ISO start and end times in UTC based on the current local time context.
3. For sheets, write data clearly. If adding expenses, format them neatly.
4. If you run a tool, briefly explain what you did and the result.
5. Do not hallucinate data. If a tool returns no items, politely tell the user there are no items found.
6. The current system time is: ${new Date().toISOString()}.
`;

export class GeminiService {
  /**
   * Helper to load conversation history from database and format it for Gemini.
   */
  public static async loadHistory(conversationId: string): Promise<Content[]> {
    const messages = await DatabaseService.query(
      'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [conversationId]
    );

    return messages.map(msg => {
      // Map roles: database stores 'user' / 'model' / 'system'.
      // Gemini expects 'user' or 'model'. We ignore system messages or map them to user.
      const role = msg.role === 'model' ? 'model' : 'user';
      return {
        role,
        parts: [{ text: msg.content }]
      };
    });
  }

  /**
   * Processes a user message, runs any required tools, and streams the output to the client.
   * Send updates as JSON objects via the writeCallback.
   */
  public static async chatAndStream(
    userId: string,
    conversationId: string,
    userMessageContent: string,
    modelName: string = 'gemini-3.5-flash',
    writeCallback: (data: string) => void
  ): Promise<string> {
    // 1. Save user message to database
    const userMsgId = crypto.randomUUID();
    await DatabaseService.query(
      'INSERT INTO messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
      [userMsgId, conversationId, 'user', userMessageContent]
    );

    // 2. Load conversation history (includes the message we just inserted)
    const contents = await this.loadHistory(conversationId);

    // Write callback helper
    const sendEvent = (type: string, payload: any) => {
      writeCallback(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
    };

    try {
      console.log(`GeminiService: Sending message: "${userMessageContent}" using model ${modelName}`);

      let fullText = '';

      for (let round = 0; ; round++) {
        if (round >= MAX_TOOL_ROUNDS) {
          const notice = '\n\n(Stopped after too many tool calls in a row, Sir.)';
          fullText += notice;
          sendEvent('chunk', { text: notice });
          break;
        }

        const stream = await ai.models.generateContentStream({
          model: modelName,
          contents,
          config: {
            systemInstruction: buildSystemPrompt(), // rebuilt per request so the current time is never stale
            temperature: 0.2,
            tools: [{ functionDeclarations: workspaceDeclarations }]
          }
        });

        // Keep every part exactly as received: function calls carry a thoughtSignature
        // that must be sent back to the model along with the tool results.
        const modelParts: Part[] = [];
        const functionCalls: FunctionCall[] = [];

        for await (const chunk of stream) {
          for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
            modelParts.push(part);
            if (part.functionCall) {
              functionCalls.push(part.functionCall);
            } else if (part.text && !part.thought) {
              fullText += part.text;
              sendEvent('chunk', { text: part.text });
            }
          }
        }

        contents.push({ role: 'model', parts: modelParts });

        if (functionCalls.length === 0) break;

        // Run every requested tool, then answer all of them in a single turn
        const responseParts: Part[] = [];
        for (const call of functionCalls) {
          const name = call.name ?? '';
          const args = call.args ?? {};
          console.log(`GeminiService: Tool invocation requested: ${name} with args`, args);

          sendEvent('tool_start', { tool: name, args });

          // Log Activity
          await DatabaseService.query(
            'INSERT INTO activity_logs (id, user_id, action_type, details) VALUES ($1, $2, $3, $4)',
            [crypto.randomUUID(), userId, `tool_${name}`, `AI invoked tool ${name} with arguments: ${JSON.stringify(args)}`]
          );

          let response: Record<string, unknown>;
          try {
            // Execute the actual tool
            const toolResult = await handleToolCall(userId, name, args);
            console.log(`GeminiService: Tool ${name} resolved successfully.`);
            sendEvent('tool_end', { tool: name, result: toolResult });
            response = { result: toolResult };
          } catch (toolError) {
            // Send failure state to model so it knows the tool failed
            console.error(`GeminiService: Tool ${name} failed:`, toolError);
            sendEvent('tool_end', { tool: name, error: (toolError as Error).message });
            response = { error: (toolError as Error).message };
          }

          responseParts.push({ functionResponse: { id: call.id, name, response } });
        }

        contents.push({ role: 'user', parts: responseParts });
      }

      // Save model's final response to database
      const assistantMsgId = crypto.randomUUID();
      await DatabaseService.query(
        'INSERT INTO messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)',
        [assistantMsgId, conversationId, 'model', fullText]
      );

      sendEvent('done', { messageId: assistantMsgId });
      return fullText;

    } catch (err) {
      console.error('GeminiService error: ', err);
      sendEvent('error', { message: (err as Error).message });
      throw err;
    }
  }
}
