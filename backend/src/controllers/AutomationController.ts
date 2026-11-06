import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import cron from 'node-cron';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { DatabaseService } from '../services/DatabaseService';
import { AutomationService } from '../services/AutomationService';

export class AutomationController {
  /**
   * GET /api/automations
   */
  public static async listAutomations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const automations = await DatabaseService.query(
        'SELECT * FROM automations WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      res.json(automations);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/automations
   */
  public static async createAutomation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { name, triggerType, cronExpression, actionType, actionConfig } = req.body;

      if (!name || !triggerType || !cronExpression || !actionType) {
        return res.status(400).json({ error: 'name, triggerType, cronExpression, and actionType are required fields.' });
      }

      if (!cron.validate(cronExpression)) {
        return res.status(400).json({ error: `Invalid cron expression: "${cronExpression}"` });
      }

      const id = crypto.randomUUID();
      const configStr = JSON.stringify(actionConfig || {});

      await DatabaseService.query(
        'INSERT INTO automations (id, user_id, name, trigger_type, cron_expression, action_type, action_config, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, userId, name, triggerType, cronExpression, actionType, configStr, true]
      );

      // Fetch the full newly created automation and schedule it
      const newAuto = await DatabaseService.queryOne('SELECT * FROM automations WHERE id = $1', [id]);
      AutomationService.scheduleJob(newAuto);

      res.status(201).json(newAuto);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/automations/:id
   */
  public static async updateAutomation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { name, cronExpression, actionType, actionConfig, isActive } = req.body;

      // Verify ownership
      const existing = await DatabaseService.queryOne(
        'SELECT id FROM automations WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (!existing) {
        return res.status(404).json({ error: 'Automation workflow not found' });
      }

      if (cronExpression !== undefined && !cron.validate(cronExpression)) {
        return res.status(400).json({ error: `Invalid cron expression: "${cronExpression}"` });
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }
      if (cronExpression !== undefined) {
        updates.push(`cron_expression = $${paramCount++}`);
        params.push(cronExpression);
      }
      if (actionType !== undefined) {
        updates.push(`action_type = $${paramCount++}`);
        params.push(actionType);
      }
      if (actionConfig !== undefined) {
        updates.push(`action_config = $${paramCount++}`);
        params.push(JSON.stringify(actionConfig));
      }
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        params.push(isActive);
      }

      if (updates.length > 0) {
        params.push(id);
        const queryStr = `UPDATE automations SET ${updates.join(', ')} WHERE id = $${paramCount}`;
        // Note: in postgres/SQLite, our db query service translates queries
        await DatabaseService.query(queryStr, params);
      }

      // Reload all cron jobs to apply updates
      await AutomationService.startAll();

      const updatedAuto = await DatabaseService.queryOne('SELECT * FROM automations WHERE id = $1', [id]);
      res.json(updatedAuto);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/automations/:id
   */
  public static async deleteAutomation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const existing = await DatabaseService.queryOne(
        'SELECT id FROM automations WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (!existing) {
        return res.status(404).json({ error: 'Automation workflow not found' });
      }

      await DatabaseService.query('DELETE FROM automations WHERE id = $1', [id]);
      
      // Reload cron schedules in memory
      await AutomationService.startAll();

      res.json({ success: true, message: 'Automation deleted and scheduling updated.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/automations/logs
   */
  public static async getLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      
      const logs = await DatabaseService.query(
        `SELECT l.id, l.status, l.output, l.run_duration_ms, l.created_at, a.name as automation_name 
         FROM automation_logs l 
         JOIN automations a ON l.automation_id = a.id 
         WHERE a.user_id = $1 
         ORDER BY l.created_at DESC LIMIT 50`,
        [userId]
      );
      
      res.json(logs);
    } catch (err) {
      next(err);
    }
  }
}
