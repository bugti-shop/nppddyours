import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadTasksFromDB, saveTasksToDB } from '@/utils/taskStorage';
import { notificationManager } from '@/utils/notifications';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ClockTimePicker } from '@/components/ClockTimePicker';
import { format, addHours, addDays } from 'date-fns';
import { Clock, CalendarIcon, AlarmClock } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface ScheduleData {
  taskId?: string;
  noteId?: string;
}

export const NotificationActionsHandler = () => {
  const navigate = useNavigate();
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  useHardwareBackButton({
    onBack: () => setShowScheduleSheet(false),
    enabled: showScheduleSheet,
    priority: 'sheet',
  });

  useEffect(() => {
    // Handle Complete action from notification
    const handleComplete = async (event: CustomEvent<{ taskId: string }>) => {
      const { taskId } = event.detail;
      try {
        const tasks = await loadTasksFromDB();
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex !== -1) {
          tasks[taskIndex].completed = true;
          tasks[taskIndex].completedAt = new Date();
          await saveTasksToDB(tasks);
          toast.success('Task completed!');
          
          // Dispatch event to refresh task lists
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
      } catch (error) {
        console.error('Error completing task from notification:', error);
        toast.error('Failed to complete task');
      }
    };

    // Handle Schedule action - open app to reschedule
    const handleScheduleTask = (event: CustomEvent<{ taskId: string }>) => {
      const { taskId } = event.detail;
      setScheduleData({ taskId });
      setShowScheduleSheet(true);
      // Navigate to ensure app is open
      navigate('/todo/today');
    };

    const handleScheduleNote = (event: CustomEvent<{ noteId: string }>) => {
      const { noteId } = event.detail;
      setScheduleData({ noteId });
      setShowScheduleSheet(true);
      // Navigate to home for notes
      navigate('/');
    };

    window.addEventListener('completeTaskFromNotification', handleComplete as EventListener);
    window.addEventListener('scheduleTaskFromNotification', handleScheduleTask as EventListener);
    window.addEventListener('scheduleNoteFromNotification', handleScheduleNote as EventListener);

    return () => {
      window.removeEventListener('completeTaskFromNotification', handleComplete as EventListener);
      window.removeEventListener('scheduleTaskFromNotification', handleScheduleTask as EventListener);
      window.removeEventListener('scheduleNoteFromNotification', handleScheduleNote as EventListener);
    };
  }, [navigate]);

  const handleQuickReschedule = async (duration: 'later_today' | 'tomorrow' | 'next_week') => {
    if (!scheduleData) return;

    let newDate = new Date();
    
    switch (duration) {
      case 'later_today':
        newDate = addHours(new Date(), 3);
        break;
      case 'tomorrow':
        newDate = addDays(new Date(), 1);
        newDate.setHours(9, 0, 0, 0);
        break;
      case 'next_week':
        newDate = addDays(new Date(), 7);
        newDate.setHours(9, 0, 0, 0);
        break;
    }

    await applyNewSchedule(newDate);
  };

  const handleCustomSchedule = async () => {
    if (!selectedDate) return;

    // Convert 12-hour to 24-hour format
    let hours24 = parseInt(hour);
    if (period === 'PM' && hours24 !== 12) {
      hours24 += 12;
    } else if (period === 'AM' && hours24 === 12) {
      hours24 = 0;
    }

    const newDate = new Date(selectedDate);
    newDate.setHours(hours24, parseInt(minute), 0, 0);

    await applyNewSchedule(newDate);
  };

  const applyNewSchedule = async (newDate: Date) => {
    if (!scheduleData) return;

    try {
      if (scheduleData.taskId) {
        const tasks = await loadTasksFromDB();
        const taskIndex = tasks.findIndex(t => t.id === scheduleData.taskId);
        
        if (taskIndex !== -1) {
          tasks[taskIndex].reminderTime = newDate;
          tasks[taskIndex].dueDate = newDate;
          await saveTasksToDB(tasks);
          
          // Reschedule the notification
          await notificationManager.scheduleTaskReminder(tasks[taskIndex]);
          
          toast.success(`Rescheduled to ${format(newDate, 'MMM d, h:mm a')}`);
          window.dispatchEvent(new CustomEvent('tasksUpdated'));
        }
      } else if (scheduleData.noteId) {
        const { loadNotesFromDB, saveNotesToDB } = await import('@/utils/noteStorage');
        const notes = await loadNotesFromDB();
        const noteIndex = notes.findIndex(n => n.id === scheduleData.noteId);
        
        if (noteIndex !== -1) {
          notes[noteIndex].reminderTime = newDate;
          await saveNotesToDB(notes);
          
          // Reschedule the notification
          await notificationManager.scheduleNoteReminder(notes[noteIndex]);
          
          toast.success(`Rescheduled to ${format(newDate, 'MMM d, h:mm a')}`);
        }
      }
    } catch (error) {
      console.error('Error rescheduling:', error);
      toast.error('Failed to reschedule');
    }

    setShowScheduleSheet(false);
    setScheduleData(null);
  };

  return (
    <Sheet open={showScheduleSheet} onOpenChange={(open) => !open && setShowScheduleSheet(false)}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Reschedule Reminder
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Quick options */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Quick Options</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="flex flex-col h-auto py-3"
                onClick={() => handleQuickReschedule('later_today')}
              >
                <Clock className="h-5 w-5 mb-1" />
                <span className="text-xs">Later Today</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col h-auto py-3"
                onClick={() => handleQuickReschedule('tomorrow')}
              >
                <CalendarIcon className="h-5 w-5 mb-1" />
                <span className="text-xs">Tomorrow</span>
              </Button>
              <Button
                variant="outline"
                className="flex flex-col h-auto py-3"
                onClick={() => handleQuickReschedule('next_week')}
              >
                <AlarmClock className="h-5 w-5 mb-1" />
                <span className="text-xs">Next Week</span>
              </Button>
            </div>
          </div>

          {/* Custom date/time picker */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Custom Date & Time</h3>
            
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-md border mx-auto"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <ClockTimePicker
                hour={hour}
                minute={minute}
                period={period}
                onHourChange={setHour}
                onMinuteChange={setMinute}
                onPeriodChange={setPeriod}
                showConfirmButton={false}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 flex-shrink-0 border-t">
          <Button variant="outline" onClick={() => setShowScheduleSheet(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleCustomSchedule} className="flex-1">
            Reschedule
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
