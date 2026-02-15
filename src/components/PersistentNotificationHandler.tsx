import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotes } from '@/contexts/NotesContext';
import { Note, NoteType, TodoItem, Folder } from '@/types/note';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { useToast } from '@/hooks/use-toast';
import { getSetting } from '@/utils/settingsStorage';
import { notificationManager } from '@/utils/notifications';
import { TaskInputSheet } from './TaskInputSheet';

export const PersistentNotificationHandler = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { saveNote } = useNotes();
  const { toast } = useToast();
  const hasProcessedPendingAction = useRef(false);
  
  // Task input sheet state
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);

  // Process an action (shared logic) - INSTANT execution
  const processAction = useCallback((actionId: string) => {
    console.log('[QuickAdd] Processing action instantly:', actionId);
    
    // Handle individual note type actions (add_note_regular, add_note_sticky, etc.)
    if (actionId.startsWith('add_note_')) {
      const noteType = actionId.replace('add_note_', '') as NoteType;
      console.log('[QuickAdd] Opening note type:', noteType);
      
      // Navigate and dispatch immediately (synchronous)
      navigate('/');
      // Use queueMicrotask for near-instant execution (faster than setTimeout)
      queueMicrotask(() => {
        window.dispatchEvent(new CustomEvent('openSpecificNoteType', {
          detail: { noteType }
        }));
      });
    } else if (actionId === 'add_task') {
      navigate('/');
      queueMicrotask(() => {
        setShowTaskInput(true);
      });
    }
  }, [navigate]);

  // Check for pending notification action on mount (INSTANT launch from notification)
  useEffect(() => {
    if (hasProcessedPendingAction.current) return;
    
    const pendingAction = sessionStorage.getItem('pendingNotificationAction');
    if (pendingAction) {
      hasProcessedPendingAction.current = true;
      console.log('[QuickAdd] Instant launch from notification:', pendingAction);
      
      // Clear immediately
      sessionStorage.removeItem('pendingNotificationAction');
      
      // Process INSTANTLY - no delay at all
      processAction(pendingAction);
    }
  }, [processAction]);

  // Load folders when task sheet opens
  useEffect(() => {
    if (showTaskInput) {
      const loadFolders = async () => {
        const savedFolders = await getSetting<Folder[]>('todo_folders', []);
        setFolders(savedFolders);
      };
      loadFolders();
    }
  }, [showTaskInput]);

  // Listen for persistent notification actions (when app is already open)
  useEffect(() => {
    const handleAction = (event: CustomEvent<{ actionId: string }>) => {
      const { actionId } = event.detail;
      console.log('[QuickAdd] Action received via event:', actionId);
      
      // Clear sessionStorage since we're handling it now
      sessionStorage.removeItem('pendingNotificationAction');
      
      processAction(actionId);
    };

    window.addEventListener('persistentNotificationAction', handleAction as EventListener);
    return () => {
      window.removeEventListener('persistentNotificationAction', handleAction as EventListener);
    };
  }, [processAction]);

  // Handle adding a task from the task input sheet
  const handleAddTask = useCallback(async (task: Omit<TodoItem, 'id' | 'completed'>) => {
    try {
      const tasks = await loadTodoItems();
      
      const newTask: TodoItem = {
        id: crypto.randomUUID(),
        ...task,
        completed: false,
        createdAt: new Date(),
      };

      await saveTodoItems([newTask, ...tasks]);
      
      // Schedule notification if reminder time is set
      if (newTask.reminderTime) {
        try {
          await notificationManager.scheduleTaskReminder(newTask);
        } catch (e) {
          console.warn('Failed to schedule notification:', e);
        }
      }
      
      toast({
        title: t('toasts.taskAdded', 'Task added'),
        description: newTask.text,
      });

      // Dispatch event to refresh task lists
      window.dispatchEvent(new CustomEvent('todoItemsChanged'));

      // Keep the sheet open so users can add more tasks
      // Sheet will be closed when user taps outside or presses back
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: t('errors.addTaskFailed', 'Failed to add task'),
        variant: 'destructive',
      });
    }
  }, [toast, t]);

  const handleCreateFolder = useCallback(async (name: string, color: string) => {
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name,
      color,
      isDefault: false,
      createdAt: new Date(),
    };
    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);
    await import('@/utils/settingsStorage').then(({ setSetting }) => {
      setSetting('todo_folders', updatedFolders);
    });
  }, [folders]);

  return (
    <TaskInputSheet
      isOpen={showTaskInput}
      onClose={() => setShowTaskInput(false)}
      onAddTask={handleAddTask}
      folders={folders}
      onCreateFolder={handleCreateFolder}
    />
  );
};
