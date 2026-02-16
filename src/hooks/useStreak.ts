// Custom hook for streak management
// Provides reactive streak data and actions

import { useState, useEffect, useCallback } from 'react';
import {
  StreakData,
  loadStreakData,
  recordCompletion,
  checkAndUpdateStreak,
  isCompletedToday,
  isStreakAtRisk,
  checkStreakStatus,
  getWeekData,
  addStreakFreeze,
  TASK_STREAK_KEY,
  getGracePeriodRemaining,
} from '@/utils/streakStorage';
import { triggerNotificationHaptic, triggerHaptic } from '@/utils/haptics';
import {
  addXp,
  XP_REWARDS,
  checkAndUnlockAchievements,
  updateChallengeProgress,
} from '@/utils/gamificationStorage';
import { updateGoalProgress } from '@/utils/weeklyGoalsStorage';

import { playStreakMilestoneSound } from '@/utils/gamificationSounds';

interface UseStreakOptions {
  storageKey?: string;
  autoCheck?: boolean;
}

interface UseStreakReturn {
  data: StreakData | null;
  isLoading: boolean;
  completedToday: boolean;
  atRisk: boolean;
  status: 'active' | 'at_risk' | 'lost' | 'new' | 'grace_period';
  weekData: Array<{ day: string; date: string; completed: boolean; isToday: boolean }>;
  recordTaskCompletion: () => Promise<{ newMilestone: number | null; usedFreeze: boolean; earnedFreeze: boolean; usedGracePeriod: boolean }>;
  addFreeze: (count?: number) => Promise<void>;
  refresh: () => Promise<void>;
  gracePeriodRemaining: number;
}

export const useStreak = (options: UseStreakOptions = {}): UseStreakReturn => {
  const { storageKey = TASK_STREAK_KEY, autoCheck = true } = options;
  
  const [data, setData] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load and check streak on mount
  const loadStreak = useCallback(async () => {
    try {
      const streakData = autoCheck 
        ? await checkAndUpdateStreak(storageKey)
        : await loadStreakData(storageKey);
      setData(streakData);
    } catch (error) {
      console.error('Failed to load streak:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, autoCheck]);

  useEffect(() => {
    loadStreak();
    
  }, [loadStreak]);

  // Listen for streak updates from other components
  useEffect(() => {
    const handleStreakUpdate = () => {
      loadStreak();
    };
    
    window.addEventListener('streakUpdated', handleStreakUpdate);
    return () => window.removeEventListener('streakUpdated', handleStreakUpdate);
  }, [loadStreak]);

  // Record a task completion
  const recordTaskCompletion = useCallback(async (): Promise<{ newMilestone: number | null; usedFreeze: boolean; earnedFreeze: boolean; usedGracePeriod: boolean }> => {
    const result = await recordCompletion(storageKey);
    setData(result.data);
    
    // Award XP for task completion
    await addXp(XP_REWARDS.TASK_COMPLETE, 'Task completed');
    
    // Award XP for streak day if streak incremented
    if (result.streakIncremented) {
      await addXp(XP_REWARDS.STREAK_DAY, 'Streak maintained');
    }
    
    // Award XP for milestones
    if (result.newMilestone) {
      const milestoneXp = {
        3: XP_REWARDS.MILESTONE_3,
        7: XP_REWARDS.MILESTONE_7,
        14: XP_REWARDS.MILESTONE_14,
        30: XP_REWARDS.MILESTONE_30,
        60: XP_REWARDS.MILESTONE_60,
        100: XP_REWARDS.MILESTONE_100,
        365: XP_REWARDS.MILESTONE_365,
      };
      const xp = milestoneXp[result.newMilestone as keyof typeof milestoneXp];
      if (xp) {
        await addXp(xp, `Milestone: ${result.newMilestone} days`);
      }
    }
    
    // Update daily challenges
    await updateChallengeProgress('complete_tasks', 1);
    
    // Check for early completion
    const hour = new Date().getHours();
    if (hour < 12) {
      await updateChallengeProgress('early_completion', 1);
    }
    
    // Check and unlock achievements
    await checkAndUnlockAchievements({
      currentStreak: result.data.currentStreak,
      totalTasks: result.data.totalCompletions,
      dailyTasks: result.data.dailyTaskCount,
      streakFreezes: result.data.streakFreezes,
      completionHour: hour,
    });
    
    // Update weekly goals
    await updateGoalProgress('weekly_tasks', 1);
    if (result.streakIncremented) {
      await updateGoalProgress('weekly_streak', 1);
    }
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('streakUpdated'));
    
    // Play milestone sound and haptic feedback
    if (result.newMilestone) {
      playStreakMilestoneSound();
      triggerNotificationHaptic('success');
      // Dispatch milestone event for celebration
      window.dispatchEvent(new CustomEvent('streakMilestone', { detail: { milestone: result.newMilestone } }));
    } else if (result.earnedFreeze || result.usedGracePeriod) {
      triggerNotificationHaptic('success');
    } else if (result.streakIncremented) {
      triggerHaptic('light');
    }
    
    return { 
      newMilestone: result.newMilestone, 
      usedFreeze: result.usedFreeze, 
      earnedFreeze: result.earnedFreeze,
      usedGracePeriod: result.usedGracePeriod
    };
  }, [storageKey]);

  // Add streak freeze
  const addFreeze = useCallback(async (count: number = 1) => {
    const updatedData = await addStreakFreeze(storageKey, count);
    setData(updatedData);
    window.dispatchEvent(new CustomEvent('streakUpdated'));
  }, [storageKey]);

  // Refresh data
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadStreak();
  }, [loadStreak]);

  // Computed values
  const completedToday = data ? isCompletedToday(data) : false;
  const atRisk = data ? isStreakAtRisk(data) : false;
  const status = data ? checkStreakStatus(data) : 'new';
  const weekData = data ? getWeekData(data) : [];
  const gracePeriodRemaining = data ? getGracePeriodRemaining(data) : 0;

  return {
    data,
    isLoading,
    completedToday,
    atRisk,
    status,
    weekData,
    recordTaskCompletion,
    addFreeze,
    refresh,
    gracePeriodRemaining,
  };
};
