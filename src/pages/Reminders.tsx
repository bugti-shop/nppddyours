import { useState, useEffect } from 'react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Note, TodoItem } from '@/types/note';
import { notificationManager } from '@/utils/notifications';
import { loadTasksFromDB } from '@/utils/taskStorage';
import { Bell, Calendar, Clock, Repeat, History, Trash2, CheckCircle2, AlarmClock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isToday, isTomorrow, isThisWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface ReminderItem {
  id: number;
  title: string;
  body: string;
  schedule: Date;
  recurring?: string;
  type: 'task' | 'note';
  taskId?: string;
  noteId?: string;
  task?: TodoItem;
  note?: Note;
}

const Reminders = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  useEffect(() => {
    loadReminders();
    loadHistory();

    const handleNotificationReceived = () => {
      loadHistory();
      loadReminders();
    };

    const handleNotificationSnoozed = (event: CustomEvent) => {
      const { snoozeLabel } = event.detail;
      toast.success(t('remindersPage.snoozedFor', { label: snoozeLabel }));
      loadHistory();
      loadReminders();
    };

    window.addEventListener('notificationReceived', handleNotificationReceived);
    window.addEventListener('notificationSnoozed', handleNotificationSnoozed as EventListener);
    
    return () => {
      window.removeEventListener('notificationReceived', handleNotificationReceived);
      window.removeEventListener('notificationSnoozed', handleNotificationSnoozed as EventListener);
    };
  }, []);

  const loadHistory = async () => {
    const history = await notificationManager.getNotificationHistory();
    setHistoryItems(history);
  };

  const handleClearHistory = async () => {
    await notificationManager.clearNotificationHistory();
    setHistoryItems([]);
    toast.success(t('remindersPage.historyCleared'));
  };

  const loadReminders = async () => {
    setLoading(true);
    try {
      const { loadNotesFromDB } = await import('@/utils/noteStorage');
      const allNotes = await loadNotesFromDB();
      const allTasks = await loadTasksFromDB();
      const pendingNotifications = await notificationManager.getPendingNotifications();

      const reminderItems: ReminderItem[] = pendingNotifications.map(notification => {
        const extra = notification.extra as any;
        const task = extra?.taskId ? allTasks.find(t => t.id === extra.taskId) : undefined;
        const note = extra?.noteId ? allNotes.find(n => n.id === extra.noteId) : undefined;

        return {
          id: notification.id,
          title: notification.title || t('remindersPage.reminder'),
          body: notification.body || '',
          schedule: notification.schedule?.at ? new Date(notification.schedule.at) : new Date(),
          recurring: extra?.recurringType,
          type: extra?.type || 'task',
          taskId: extra?.taskId,
          noteId: extra?.noteId,
          task,
          note,
        };
      }).filter(r => r.schedule > new Date());

      reminderItems.sort((a, b) => a.schedule.getTime() - b.schedule.getTime());
      setReminders(reminderItems);
    } catch (error) {
      console.error('Error loading reminders:', error);
      loadRemindersFromStorage();
    } finally {
      setLoading(false);
    }
  };

  const loadRemindersFromStorage = async () => {
    const { loadNotesFromDB } = await import('@/utils/noteStorage');
    const allNotes = await loadNotesFromDB();
    const allTasks = await loadTasksFromDB();

    const reminderItems: ReminderItem[] = [];

    allNotes.forEach(note => {
      if (note.reminderEnabled && note.reminderTime) {
        const reminderDate = new Date(note.reminderTime);
        if (reminderDate > new Date()) {
          reminderItems.push({
            id: parseInt(note.id.slice(0, 8), 16) || Date.now(),
            title: note.title || t('remindersPage.noteReminder'),
            body: note.content?.slice(0, 100) || '',
            schedule: reminderDate,
            recurring: note.reminderRecurring,
            type: 'note',
            noteId: note.id,
            note,
          });
        }
      }
    });

    allTasks.forEach(task => {
      if ((task.reminderTime || task.dueDate) && !task.completed) {
        const reminderDate = task.reminderTime ? new Date(task.reminderTime) : new Date(task.dueDate!);
        if (reminderDate > new Date()) {
          reminderItems.push({
            id: parseInt(task.id.slice(0, 8), 16) || Date.now(),
            title: t('remindersPage.taskReminder'),
            body: task.text,
            schedule: reminderDate,
            recurring: task.repeatType !== 'none' ? task.repeatType : undefined,
            type: 'task',
            taskId: task.id,
            task,
          });
        }
      }
    });

    reminderItems.sort((a, b) => a.schedule.getTime() - b.schedule.getTime());
    setReminders(reminderItems);
  };

  const formatReminderDate = (date: Date) => {
    if (isToday(date)) {
      return t('remindersPage.todayAt', { time: format(date, 'h:mm a') });
    } else if (isTomorrow(date)) {
      return t('remindersPage.tomorrowAt', { time: format(date, 'h:mm a') });
    } else if (isThisWeek(date)) {
      return t('remindersPage.weekdayAt', { day: format(date, 'EEEE'), time: format(date, 'h:mm a') });
    } else {
      return t('remindersPage.dateAt', { date: format(date, 'MMM dd'), time: format(date, 'h:mm a') });
    }
  };

  const getRecurringBadge = (recurring?: string) => {
    if (!recurring || recurring === 'none') return null;

    const labels: Record<string, string> = {
      daily: t('remindersPage.daily'),
      weekly: t('remindersPage.weekly'),
      monthly: t('remindersPage.monthly'),
      yearly: t('remindersPage.yearly'),
      hour: t('remindersPage.hourly'),
    };

    return (
      <Badge variant="secondary" className="gap-1">
        <Repeat className="h-3 w-3" />
        {labels[recurring] || recurring}
      </Badge>
    );
  };

  const groupedReminders = {
    today: reminders.filter(r => isToday(r.schedule)),
    tomorrow: reminders.filter(r => isTomorrow(r.schedule)),
    thisWeek: reminders.filter(r => !isToday(r.schedule) && !isTomorrow(r.schedule) && isThisWeek(r.schedule)),
    later: reminders.filter(r => !isThisWeek(r.schedule)),
  };

  const ReminderCard = ({ reminder }: { reminder: ReminderItem }) => (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => {
        if (reminder.type === 'task') {
          navigate('/todo/today');
        } else {
          navigate('/');
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate mb-1">
              {reminder.title}
            </h3>
            {reminder.body && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {reminder.body}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {format(reminder.schedule, 'h:mm a')}
              </Badge>
              {getRecurringBadge(reminder.recurring)}
            </div>
          </div>
          <Badge className={cn(
            "capitalize",
            reminder.type === 'task' ? "bg-cyan-500" : "bg-purple-500"
          )}>
            {t(`remindersPage.${reminder.type}`)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  const ReminderSection = ({ title, items }: { title: string; items: ReminderItem[] }) => {
    if (items.length === 0) return null;
    return (
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          {title}
        </h2>
        <div className="space-y-3">
          {items.map((reminder) => (
            <ReminderCard key={`${reminder.type}-${reminder.id}`} reminder={reminder} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b sticky top-0 bg-card z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center gap-2">
            <img src="/src/assets/app-logo.png" alt="Npd" className="h-8 w-8" />
            <h1 className="text-xl font-bold">{t('remindersPage.title')}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="upcoming">{t('remindersPage.upcoming')}</TabsTrigger>
            <TabsTrigger value="history">{t('remindersPage.history')}</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {loading ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground">{t('remindersPage.loading')}</p>
              </div>
            ) : reminders.length === 0 ? (
              <div className="text-center py-20">
                <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('remindersPage.noUpcoming')}</h2>
                <p className="text-muted-foreground">
                  {t('remindersPage.noUpcomingDesc')}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <ReminderSection title={t('remindersPage.today')} items={groupedReminders.today} />
                <ReminderSection title={t('remindersPage.tomorrow')} items={groupedReminders.tomorrow} />
                <ReminderSection title={t('remindersPage.thisWeek')} items={groupedReminders.thisWeek} />
                <ReminderSection title={t('remindersPage.later')} items={groupedReminders.later} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            {historyItems.length === 0 ? (
              <div className="text-center py-20">
                <History className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('remindersPage.noHistory')}</h2>
                <p className="text-muted-foreground">
                  {t('remindersPage.noHistoryDesc')}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-muted-foreground">
                    {t('remindersPage.notificationCount', { count: historyItems.length })}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearHistory}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('remindersPage.clearHistory')}
                  </Button>
                </div>
                <div className="space-y-3">
                  {historyItems.map((item, index) => (
                    <Card key={`${item.id}-${index}`} className={cn(
                      "cursor-pointer hover:shadow-md transition-shadow",
                      !item.read && "border-primary/50"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate mb-1">
                              {item.title}
                            </h3>
                            {item.body && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {item.body}
                              </p>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={item.read ? "default" : "secondary"} className="gap-1">
                                {item.read ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <Bell className="h-3 w-3" />
                                )}
                                {item.read ? t('remindersPage.read') : t('remindersPage.unread')}
                              </Badge>
                              {item.snoozed && (
                                <Badge variant="outline" className="gap-1 text-orange-500 border-orange-500">
                                  <AlarmClock className="h-3 w-3" />
                                  {t('remindersPage.snoozed', { label: item.snoozeLabel })}
                                </Badge>
                              )}
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(item.timestamp), 'MMM dd, h:mm a')}
                              </Badge>
                              {item.extra?.recurringType && (
                                <Badge variant="secondary" className="gap-1">
                                  <Repeat className="h-3 w-3" />
                                  {String(t(`remindersPage.${item.extra.recurringType}`, item.extra.recurringType))}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Badge className={cn(
                            "capitalize",
                            item.extra?.type === 'task' ? "bg-cyan-500" : "bg-purple-500"
                          )}>
                            {t(`remindersPage.${item.extra?.type || 'notification'}`)}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default Reminders;
