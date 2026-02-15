import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoLayout } from './TodoLayout';
import { useStreak } from '@/hooks/useStreak';
import { cn } from '@/lib/utils';
import { Flame, Check, Snowflake, Trophy, Zap, TrendingUp, Calendar, Gift, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadTodoItems } from '@/utils/todoItemsStorage';
import { startOfWeek, endOfWeek } from 'date-fns';
import Confetti from 'react-confetti';


const Progress = () => {
  const { t } = useTranslation();
  const { data, isLoading, completedToday, atRisk, status, weekData, gracePeriodRemaining } = useStreak();
  const [showConfetti, setShowConfetti] = useState(false);
  const [celebratingMilestone, setCelebratingMilestone] = useState<number | null>(null);
  const [weekStats, setWeekStats] = useState({ completed: 0, total: 0 });
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Handle window resize for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for milestone celebrations
  useEffect(() => {
    const handleMilestone = (e: CustomEvent<{ milestone: number }>) => {
      setCelebratingMilestone(e.detail.milestone);
      setShowConfetti(true);
      setTimeout(() => {
        setShowConfetti(false);
        setCelebratingMilestone(null);
      }, 4000);
    };
    
    window.addEventListener('streakMilestone', handleMilestone as EventListener);
    return () => window.removeEventListener('streakMilestone', handleMilestone as EventListener);
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const tasks = await loadTodoItems();
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

        // Week stats
        const thisWeekTasks = tasks.filter(task => {
          if (!task.completedAt) return false;
          const completedDate = new Date(task.completedAt);
          return completedDate >= weekStart && completedDate <= weekEnd;
        });
        setWeekStats({
          completed: thisWeekTasks.length,
          total: tasks.filter(t => t.completed).length,
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };
    loadStats();

    const handler = () => loadStats();
    window.addEventListener('tasksUpdated', handler);
    return () => window.removeEventListener('tasksUpdated', handler);
  }, []);

  // Get encouraging message based on status
  const getMessage = () => {
    if (completedToday) {
      if (data?.currentStreak === 1) {
        return t('streak.firstDayComplete', "Great start! Let's keep going tomorrow.");
      }
      return t('streak.continueMessage', "I knew you'd come back! Let's do this again tomorrow.");
    }
    
    if (status === 'grace_period') {
      return t('streak.gracePeriodMessage', `You have ${gracePeriodRemaining} hours to save your streak!`);
    }
    
    if (status === 'lost' || status === 'new') {
      return t('streak.newStreakMessage', 'New streaks start today. Complete one task to begin!');
    }
    
    if (atRisk) {
      return t('streak.atRiskMessage', 'Complete one task today to keep your streak going!');
    }
    
    return t('streak.keepGoingMessage', 'You\'re on a roll! Keep it up.');
  };

  // Milestone badges - using semantic color classes
  const milestones = [
    { value: 3, icon: Zap, label: '3 days', color: 'text-warning' },
    { value: 7, icon: Trophy, label: '1 week', color: 'text-info' },
    { value: 14, icon: TrendingUp, label: '2 weeks', color: 'text-success' },
    { value: 30, icon: Flame, label: '1 month', color: 'text-streak' },
  ];

  if (isLoading) {
    return (
      <TodoLayout title={t('nav.progress', 'Progress')}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </TodoLayout>
    );
  }

  // Calculate freeze progress
  const TASKS_FOR_FREEZE = 5;
  const dailyTaskCount = data?.dailyTaskCount || 0;
  const freezeProgress = Math.min(dailyTaskCount, TASKS_FOR_FREEZE);
  const freezeProgressPercent = (freezeProgress / TASKS_FOR_FREEZE) * 100;

  return (
    <TodoLayout title={t('nav.progress', 'Progress')}>
      {/* Confetti for milestones */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}
      
      {/* Milestone celebration overlay */}
      <AnimatePresence>
        {celebratingMilestone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                <Flame className="h-24 w-24 text-streak fill-streak/80 mx-auto" />
              </motion.div>
              <h2 className="text-4xl font-bold mt-4 text-foreground">{celebratingMilestone} {t('streak.days', 'days')}!</h2>
              <p className="text-muted-foreground mt-2">{t('streak.milestoneReached', 'Milestone reached!')}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-6 space-y-6">
        
        {/* Streak Card */}

        {/* Streak Card */}
        <div className="bg-card rounded-2xl p-6 border shadow-sm">
          {/* Message Bubble */}
          <div className="relative bg-muted rounded-xl p-4 mb-6">
            <p className="text-sm text-foreground">{getMessage()}</p>
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-muted rotate-45" />
          </div>
          
          {/* Flame Icon and Streak Count */}
          <div className="flex flex-col items-center py-6">
            <motion.div
              animate={{ 
                scale: completedToday ? [1, 1.1, 1] : 1,
              }}
              transition={{ duration: 0.5, repeat: completedToday ? 0 : undefined }}
              className="relative"
            >
              <Flame 
                className={cn(
                  "h-24 w-24 transition-colors",
                  completedToday ? "text-streak fill-streak/80" : "text-muted-foreground/30"
                )} 
              />
              {data?.currentStreak !== undefined && data.currentStreak > 0 && (
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-streak-foreground drop-shadow-md mt-2">
                  {data.currentStreak}
                </span>
              )}
            </motion.div>
            
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-center mt-4"
            >
              <h2 className={cn(
                "text-5xl font-bold",
                completedToday ? "text-streak" : "text-muted-foreground"
              )}>
                {data?.currentStreak || 0}
              </h2>
              <p className={cn(
                "text-lg font-medium",
                completedToday ? "text-streak" : "text-muted-foreground"
              )}>
                {t('streak.dayStreak', 'day streak')}
              </p>
            </motion.div>
          </div>
          
          {/* Week Progress */}
          <div className="flex justify-between items-center gap-1 mt-6 overflow-hidden">
            {weekData.map((day, index) => (
              <div key={day.date} className="flex flex-col items-center gap-2 min-w-0 flex-1">
                <span className={cn(
                  "text-xs font-medium truncate",
                  day.isToday ? "text-primary" : "text-muted-foreground"
                )}>
                  {day.day}
                </span>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0",
                    day.completed 
                      ? "bg-streak border-streak text-streak-foreground" 
                      : day.isToday 
                        ? "border-primary bg-primary/10" 
                        : "border-muted bg-muted/50"
                  )}
                >
                  {day.completed && <Check className="h-4 w-4 sm:h-5 sm:w-5" />}
                </motion.div>
              </div>
            ))}
          </div>
          
          {/* Grace Period Indicator */}
          {status === 'grace_period' && gracePeriodRemaining > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 mt-6 pt-4 border-t bg-warning/10 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl"
            >
              <Clock className="h-5 w-5 text-warning" />
              <span className="text-sm text-warning font-medium">
                {t('streak.gracePeriodActive', '{{hours}}h grace period remaining - complete a task to save your streak!', { hours: gracePeriodRemaining })}
              </span>
            </motion.div>
          )}
          
          {/* Streak Freezes */}
          {status !== 'grace_period' && data?.streakFreezes !== undefined && data.streakFreezes > 0 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
              <Snowflake className="h-5 w-5 text-info" />
              <span className="text-sm text-muted-foreground">
                {data.streakFreezes} {t('streak.freezesAvailable', 'streak freeze(s) available')}
              </span>
            </div>
          )}
          
          {/* Freeze Progress - Show progress towards earning a freeze */}
          {!data?.freezesEarnedToday && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-info" />
                <span className="text-sm text-muted-foreground">
                  {t('streak.earnFreeze', 'Complete {{remaining}} more tasks today to earn a freeze', { remaining: TASKS_FOR_FREEZE - freezeProgress })}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${freezeProgressPercent}%` }}
                  className="bg-info h-2 rounded-full"
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">{freezeProgress}/{TASKS_FOR_FREEZE}</span>
              </div>
            </div>
          )}
          
          {data?.freezesEarnedToday && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
              <Gift className="h-5 w-5 text-success" />
              <span className="text-sm text-success">
                {t('streak.freezeEarnedToday', 'Freeze earned today! 🎉')}
              </span>
            </div>
          )}
        </div>
        
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.longestStreak', 'Longest Streak')}</span>
            </div>
            <p className="text-2xl font-bold">{data?.longestStreak || 0} <span className="text-sm font-normal text-muted-foreground">{t('streak.days', 'days')}</span></p>
          </div>
          
          <div className="bg-card rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Check className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.totalCompleted', 'Total Completed')}</span>
            </div>
            <p className="text-2xl font-bold">{data?.totalCompletions || 0} <span className="text-sm font-normal text-muted-foreground">{t('streak.tasks', 'tasks')}</span></p>
          </div>
          
          <div className="bg-card rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.thisWeek', 'This Week')}</span>
            </div>
            <p className="text-2xl font-bold">{weekStats.completed} <span className="text-sm font-normal text-muted-foreground">{t('streak.tasks', 'tasks')}</span></p>
          </div>
          
          <div className="bg-card rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Snowflake className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.freezes', 'Freezes')}</span>
            </div>
            <p className="text-2xl font-bold">{data?.streakFreezes || 0}</p>
          </div>
        </div>
        
        
        {/* Milestones */}
        <div className="bg-card rounded-xl p-4 border">
          <h3 className="font-semibold mb-4">{t('streak.milestones', 'Milestones')}</h3>
          <div className="grid grid-cols-4 gap-3">
            {milestones.map((milestone) => {
              const achieved = data?.milestones?.includes(milestone.value);
              const Icon = milestone.icon;
              
              return (
                <div 
                  key={milestone.value}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                    achieved 
                      ? "border-primary/50 bg-primary/5" 
                      : "border-muted bg-muted/30 opacity-50"
                  )}
                >
                  <Icon className={cn("h-6 w-6", achieved ? milestone.color : "text-muted-foreground")} />
                  <span className="text-xs font-medium text-center">{milestone.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* At Risk Warning */}
        <AnimatePresence>
          {atRisk && !completedToday && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-streak/10 border border-streak/30 rounded-xl p-4 flex items-center gap-3"
            >
              <Flame className="h-5 w-5 text-streak flex-shrink-0" />
              <p className="text-sm text-streak">
                {t('streak.atRiskWarning', 'Complete one task today to keep your streak going!')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TodoLayout>
  );
};

export default Progress;
