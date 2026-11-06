import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { ChatController } from '../controllers/ChatController';
import { WorkspaceController } from '../controllers/WorkspaceController';
import { AutomationController } from '../controllers/AutomationController';
import { SettingsController } from '../controllers/SettingsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// --- Authentication Routes ---
router.get('/auth/google', AuthController.getGoogleUrl);
router.post('/auth/google/callback', AuthController.handleCallback);
router.get('/auth/me', authMiddleware, AuthController.getProfile);
router.post('/auth/logout', AuthController.logout);

// --- Conversational Chat Routes ---
router.get('/chat/conversations', authMiddleware, ChatController.listConversations);
router.post('/chat/conversations', authMiddleware, ChatController.createConversation);
router.get('/chat/conversations/:id/messages', authMiddleware, ChatController.getMessages);
router.delete('/chat/conversations/:id', authMiddleware, ChatController.deleteConversation);
router.post('/chat/messages', authMiddleware, ChatController.sendMessage);

// --- Google Workspace REST Routes ---
router.get('/workspace/dashboard', authMiddleware, WorkspaceController.getDashboardSummary);
router.get('/workspace/emails', authMiddleware, WorkspaceController.listEmails);
router.get('/workspace/emails/:id', authMiddleware, WorkspaceController.getEmailDetail);
router.post('/workspace/emails/send', authMiddleware, WorkspaceController.sendEmail);
router.post('/workspace/emails/:id/archive', authMiddleware, WorkspaceController.archiveEmail);
router.delete('/workspace/emails/:id', authMiddleware, WorkspaceController.deleteEmail);

router.get('/workspace/calendar/events', authMiddleware, WorkspaceController.listCalendarEvents);
router.post('/workspace/calendar/events', authMiddleware, WorkspaceController.createCalendarEvent);
router.delete('/workspace/calendar/events/:id', authMiddleware, WorkspaceController.deleteCalendarEvent);

router.get('/workspace/sheets/:id', authMiddleware, WorkspaceController.getSpreadsheetInfo);
router.post('/workspace/sheets/:id/read-range', authMiddleware, WorkspaceController.readSheetRange);
router.post('/workspace/sheets/:id/append', authMiddleware, WorkspaceController.appendSheetRows);

router.get('/workspace/activity', authMiddleware, WorkspaceController.listActivityLogs);

// --- Automation Control Routes ---
router.get('/automations', authMiddleware, AutomationController.listAutomations);
router.post('/automations', authMiddleware, AutomationController.createAutomation);
router.put('/automations/:id', authMiddleware, AutomationController.updateAutomation);
router.delete('/automations/:id', authMiddleware, AutomationController.deleteAutomation);
router.get('/automations/logs', authMiddleware, AutomationController.getLogs);

// --- User Settings Routes ---
router.put('/settings/preferences', authMiddleware, SettingsController.updatePreferences);
router.post('/settings/disconnect-google', authMiddleware, SettingsController.disconnectGoogle);

export default router;
