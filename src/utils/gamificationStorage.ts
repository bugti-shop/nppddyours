// Gamification system: XP, Levels, Achievements, Daily Challenges
// Provides engagement and retention mechanics

import { getSetting, setSetting } from './settingsStorage';
import { format, startOfDay, differenceInDays } from 'date-fns';

// ==================== XP & LEVELS ====================

export interface XpData {
  totalXp: number;
  currentLevel: number;
  xpToNextLevel: number;
  xpInCurrentLevel: number;
  dailyXpEarned: number;
  lastXpDate: string | null;
  xpHistory: Record<string, number>; // date -> xp earned
}

// Level thresholds (XP required to reach each level)
const LEVEL_THRESHOLDS = [
  0,      // Level 1: 0 XP
  100,    // Level 2: 100 XP
  250,    // Level 3: 250 XP
  500,    // Level 4: 500 XP
  850,    // Level 5: 850 XP
  1300,   // Level 6: 1300 XP
  1900,   // Level 7: 1900 XP
  2700,   // Level 8: 2700 XP
  3700,   // Level 9: 3700 XP
  5000,   // Level 10: 5000 XP
  6500,   // Level 11: 6500 XP
  8500,   // Level 12: 8500 XP
  11000,  // Level 13: 11000 XP
  14000,  // Level 14: 14000 XP
  18000,  // Level 15: 18000 XP
  23000,  // Level 16: 23000 XP
  29000,  // Level 17: 29000 XP
  36000,  // Level 18: 36000 XP
  45000,  // Level 19: 45000 XP
  55000,  // Level 20: 55000 XP
];

// XP rewards
export const XP_REWARDS = {
  TASK_COMPLETE: 10,
  SUBTASK_COMPLETE: 5,
  STREAK_DAY: 15,
  CHALLENGE_COMPLETE: 25,
  MILESTONE_3: 50,
  MILESTONE_7: 100,
  MILESTONE_14: 150,
  MILESTONE_30: 300,
  MILESTONE_60: 500,
  MILESTONE_100: 1000,
  MILESTONE_365: 5000,
};

const XP_STORAGE_KEY = 'npd_xp_data';

const getDefaultXpData = (): XpData => ({
  totalXp: 0,
  currentLevel: 1,
  xpToNextLevel: LEVEL_THRESHOLDS[1],
  xpInCurrentLevel: 0,
  dailyXpEarned: 0,
  lastXpDate: null,
  xpHistory: {},
});

export const loadXpData = async (): Promise<XpData> => {
  return getSetting<XpData>(XP_STORAGE_KEY, getDefaultXpData());
};

const calculateLevel = (totalXp: number): { level: number; xpInLevel: number; xpToNext: number } => {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] * 1.5;
  
  return {
    level,
    xpInLevel: totalXp - currentThreshold,
    xpToNext: nextThreshold - currentThreshold,
  };
};

export const addXp = async (amount: number, reason?: string): Promise<{ data: XpData; leveledUp: boolean; newLevel: number | null }> => {
  const data = await loadXpData();
  const today = format(new Date(), 'yyyy-MM-dd');
  const previousLevel = data.currentLevel;
  
  // Reset daily XP if new day
  if (data.lastXpDate !== today) {
    data.dailyXpEarned = 0;
    data.lastXpDate = today;
  }
  
  // Add XP
  data.totalXp += amount;
  data.dailyXpEarned += amount;
  data.xpHistory[today] = (data.xpHistory[today] || 0) + amount;
  
  // Calculate new level
  const { level, xpInLevel, xpToNext } = calculateLevel(data.totalXp);
  data.currentLevel = level;
  data.xpInCurrentLevel = xpInLevel;
  data.xpToNextLevel = xpToNext;
  
  // Clean up old history (keep last 90 days)
  const cutoffDate = format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const cleanedHistory: Record<string, number> = {};
  for (const [date, xp] of Object.entries(data.xpHistory)) {
    if (date >= cutoffDate) {
      cleanedHistory[date] = xp;
    }
  }
  data.xpHistory = cleanedHistory;
  
  await setSetting(XP_STORAGE_KEY, data);
  
  const leveledUp = level > previousLevel;
  
  if (leveledUp) {
    window.dispatchEvent(new CustomEvent('levelUp', { detail: { level } }));
  }
  
  window.dispatchEvent(new CustomEvent('xpUpdated', { detail: { amount, total: data.totalXp } }));
  
  // Update weekly XP goal
  try {
    const { updateGoalProgress } = await import('./weeklyGoalsStorage');
    await updateGoalProgress('weekly_xp', amount);
  } catch (e) {
    // Weekly goals may not be loaded yet
  }
  
  return { data, leveledUp, newLevel: leveledUp ? level : null };
};

export const getLevelTitle = (level: number): string => {
  const titles = [
    'Beginner',        // 1
    'Apprentice',      // 2
    'Task Tamer',      // 3
    'Focus Fighter',   // 4
    'Productivity Pro', // 5
    'Goal Getter',     // 6
    'Task Master',     // 7
    'Streak Warrior',  // 8
    'Efficiency Expert', // 9
    'Time Lord',       // 10
    'Achievement Hunter', // 11
    'Discipline Guru', // 12
    'Workflow Wizard', // 13
    'Habit Hero',      // 14
    'Productivity Legend', // 15
    'Task Titan',      // 16
    'Master Planner',  // 17
    'Elite Achiever',  // 18
    'Supreme Organizer', // 19
    'Ultimate Champion', // 20
  ];
  return titles[Math.min(level - 1, titles.length - 1)] || 'Champion';
};

// ==================== ACHIEVEMENTS/BADGES ====================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'tasks' | 'consistency' | 'special';
  requirement: number;
  xpReward: number;
  unlockedAt?: string;
}

export interface AchievementsData {
  unlockedAchievements: string[];
  achievementDates: Record<string, string>;
}

const ACHIEVEMENTS_STORAGE_KEY = 'npd_achievements';

export const ALL_ACHIEVEMENTS: Achievement[] = [
  // Streak achievements
  { id: 'streak_3', name: 'Getting Started', description: 'Maintain a 3-day streak', icon: '🌱', category: 'streak', requirement: 3, xpReward: 50 },
  { id: 'streak_7', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', category: 'streak', requirement: 7, xpReward: 100 },
  { id: 'streak_14', name: 'Two Week Champion', description: 'Maintain a 14-day streak', icon: '⚡', category: 'streak', requirement: 14, xpReward: 150 },
  { id: 'streak_30', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: '🏆', category: 'streak', requirement: 30, xpReward: 300 },
  { id: 'streak_60', name: 'Unstoppable', description: 'Maintain a 60-day streak', icon: '💎', category: 'streak', requirement: 60, xpReward: 500 },
  { id: 'streak_100', name: 'Century Club', description: 'Maintain a 100-day streak', icon: '👑', category: 'streak', requirement: 100, xpReward: 1000 },
  { id: 'streak_365', name: 'Year of Dedication', description: 'Maintain a 365-day streak', icon: '🌟', category: 'streak', requirement: 365, xpReward: 5000 },
  
  // Task completion achievements
  { id: 'tasks_10', name: 'First Steps', description: 'Complete 10 tasks', icon: '📝', category: 'tasks', requirement: 10, xpReward: 25 },
  { id: 'tasks_50', name: 'Task Tackler', description: 'Complete 50 tasks', icon: '✅', category: 'tasks', requirement: 50, xpReward: 75 },
  { id: 'tasks_100', name: 'Century Achiever', description: 'Complete 100 tasks', icon: '💯', category: 'tasks', requirement: 100, xpReward: 150 },
  { id: 'tasks_500', name: 'Task Machine', description: 'Complete 500 tasks', icon: '🚀', category: 'tasks', requirement: 500, xpReward: 500 },
  { id: 'tasks_1000', name: 'Task Legend', description: 'Complete 1000 tasks', icon: '🏅', category: 'tasks', requirement: 1000, xpReward: 1000 },
  
  // Daily productivity
  { id: 'daily_5', name: 'Productive Day', description: 'Complete 5 tasks in one day', icon: '⭐', category: 'consistency', requirement: 5, xpReward: 30 },
  { id: 'daily_10', name: 'Super Productive', description: 'Complete 10 tasks in one day', icon: '🌟', category: 'consistency', requirement: 10, xpReward: 75 },
  { id: 'daily_20', name: 'Productivity Beast', description: 'Complete 20 tasks in one day', icon: '🔮', category: 'consistency', requirement: 20, xpReward: 150 },
  
  // Special achievements
  { id: 'early_bird', name: 'Early Bird', description: 'Complete a task before 6 AM', icon: '🌅', category: 'special', requirement: 1, xpReward: 50 },
  { id: 'night_owl', name: 'Night Owl', description: 'Complete a task after midnight', icon: '🦉', category: 'special', requirement: 1, xpReward: 50 },
  { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Complete tasks on both Saturday and Sunday', icon: '🎮', category: 'special', requirement: 1, xpReward: 75 },
  { id: 'freeze_collector', name: 'Freeze Collector', description: 'Earn 5 streak freezes', icon: '❄️', category: 'special', requirement: 5, xpReward: 100 },
  { id: 'level_10', name: 'Double Digits', description: 'Reach level 10', icon: '🎯', category: 'special', requirement: 10, xpReward: 200 },
];

const getDefaultAchievementsData = (): AchievementsData => ({
  unlockedAchievements: [],
  achievementDates: {},
});

export const loadAchievementsData = async (): Promise<AchievementsData> => {
  return getSetting<AchievementsData>(ACHIEVEMENTS_STORAGE_KEY, getDefaultAchievementsData());
};

export const unlockAchievement = async (achievementId: string): Promise<{ unlocked: boolean; achievement: Achievement | null }> => {
  const data = await loadAchievementsData();
  const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
  
  if (!achievement || data.unlockedAchievements.includes(achievementId)) {
    return { unlocked: false, achievement: null };
  }
  
  data.unlockedAchievements.push(achievementId);
  data.achievementDates[achievementId] = new Date().toISOString();
  await setSetting(ACHIEVEMENTS_STORAGE_KEY, data);
  
  // Award XP for achievement
  await addXp(achievement.xpReward, `Achievement: ${achievement.name}`);
  
  window.dispatchEvent(new CustomEvent('achievementUnlocked', { detail: { achievement } }));
  
  return { unlocked: true, achievement };
};

export const checkAndUnlockAchievements = async (stats: {
  currentStreak?: number;
  totalTasks?: number;
  dailyTasks?: number;
  streakFreezes?: number;
  level?: number;
  completionHour?: number;
  isWeekend?: boolean;
}): Promise<Achievement[]> => {
  const newlyUnlocked: Achievement[] = [];
  
  // Check streak achievements
  if (stats.currentStreak) {
    const streakAchievements = ['streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_60', 'streak_100', 'streak_365'];
    for (const id of streakAchievements) {
      const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
      if (achievement && stats.currentStreak >= achievement.requirement) {
        const result = await unlockAchievement(id);
        if (result.unlocked && result.achievement) {
          newlyUnlocked.push(result.achievement);
        }
      }
    }
  }
  
  // Check task achievements
  if (stats.totalTasks) {
    const taskAchievements = ['tasks_10', 'tasks_50', 'tasks_100', 'tasks_500', 'tasks_1000'];
    for (const id of taskAchievements) {
      const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
      if (achievement && stats.totalTasks >= achievement.requirement) {
        const result = await unlockAchievement(id);
        if (result.unlocked && result.achievement) {
          newlyUnlocked.push(result.achievement);
        }
      }
    }
  }
  
  // Check daily achievements
  if (stats.dailyTasks) {
    const dailyAchievements = ['daily_5', 'daily_10', 'daily_20'];
    for (const id of dailyAchievements) {
      const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
      if (achievement && stats.dailyTasks >= achievement.requirement) {
        const result = await unlockAchievement(id);
        if (result.unlocked && result.achievement) {
          newlyUnlocked.push(result.achievement);
        }
      }
    }
  }
  
  // Check special achievements
  if (stats.completionHour !== undefined) {
    if (stats.completionHour < 6) {
      const result = await unlockAchievement('early_bird');
      if (result.unlocked && result.achievement) newlyUnlocked.push(result.achievement);
    }
    if (stats.completionHour >= 0 && stats.completionHour < 5) {
      const result = await unlockAchievement('night_owl');
      if (result.unlocked && result.achievement) newlyUnlocked.push(result.achievement);
    }
  }
  
  if (stats.streakFreezes && stats.streakFreezes >= 5) {
    const result = await unlockAchievement('freeze_collector');
    if (result.unlocked && result.achievement) newlyUnlocked.push(result.achievement);
  }
  
  if (stats.level && stats.level >= 10) {
    const result = await unlockAchievement('level_10');
    if (result.unlocked && result.achievement) newlyUnlocked.push(result.achievement);
  }
  
  return newlyUnlocked;
};

// ==================== DAILY CHALLENGES ====================

export interface DailyChallenge {
  id: string;
  type: 'complete_tasks' | 'early_completion' | 'streak_maintain' | 'speed_run' | 'no_skip';
  title: string;
  description: string;
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
  icon: string;
}

export interface DailyChallengesData {
  date: string;
  challenges: DailyChallenge[];
  refreshCount: number;
}

const CHALLENGES_STORAGE_KEY = 'npd_daily_challenges';

const CHALLENGE_TEMPLATES = [
  { type: 'complete_tasks', title: 'Task Blitz', description: 'Complete {target} tasks today', targets: [3, 5, 7, 10], xpRewards: [20, 35, 50, 75], icon: '🎯' },
  { type: 'early_completion', title: 'Early Bird Challenge', description: 'Complete {target} tasks before noon', targets: [2, 3, 5], xpRewards: [25, 40, 60], icon: '🌅' },
  { type: 'streak_maintain', title: 'Streak Guardian', description: 'Maintain your streak for another day', targets: [1], xpRewards: [30], icon: '🔥' },
  { type: 'speed_run', title: 'Speed Runner', description: 'Complete {target} tasks within an hour', targets: [3, 5], xpRewards: [40, 65], icon: '⚡' },
  { type: 'no_skip', title: 'No Task Left Behind', description: 'Complete all tasks you start today', targets: [1], xpRewards: [50], icon: '✨' },
];

const generateDailyChallenges = (): DailyChallenge[] => {
  const challenges: DailyChallenge[] = [];
  const shuffled = [...CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);
  
  // Pick 3 random challenges
  for (let i = 0; i < 3 && i < shuffled.length; i++) {
    const template = shuffled[i];
    const targetIndex = Math.floor(Math.random() * template.targets.length);
    const target = template.targets[targetIndex];
    const xpReward = template.xpRewards[targetIndex];
    
    challenges.push({
      id: `${template.type}_${Date.now()}_${i}`,
      type: template.type as DailyChallenge['type'],
      title: template.title,
      description: template.description.replace('{target}', target.toString()),
      target,
      current: 0,
      xpReward,
      completed: false,
      icon: template.icon,
    });
  }
  
  return challenges;
};

export const loadDailyChallenges = async (): Promise<DailyChallengesData> => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const data = await getSetting<DailyChallengesData>(CHALLENGES_STORAGE_KEY, {
    date: today,
    challenges: generateDailyChallenges(),
    refreshCount: 0,
  });
  
  // Generate new challenges if it's a new day
  if (data.date !== today) {
    const newData: DailyChallengesData = {
      date: today,
      challenges: generateDailyChallenges(),
      refreshCount: 0,
    };
    await setSetting(CHALLENGES_STORAGE_KEY, newData);
    return newData;
  }
  
  return data;
};

export const updateChallengeProgress = async (
  type: DailyChallenge['type'],
  increment: number = 1
): Promise<{ completed: DailyChallenge | null; data: DailyChallengesData }> => {
  const data = await loadDailyChallenges();
  let completedChallenge: DailyChallenge | null = null;
  
  for (const challenge of data.challenges) {
    if (challenge.type === type && !challenge.completed) {
      challenge.current += increment;
      
      if (challenge.current >= challenge.target) {
        challenge.completed = true;
        completedChallenge = challenge;
        
        // Award XP
        await addXp(challenge.xpReward, `Challenge: ${challenge.title}`);
        
        window.dispatchEvent(new CustomEvent('challengeCompleted', { detail: { challenge } }));
      }
    }
  }
  
  await setSetting(CHALLENGES_STORAGE_KEY, data);
  return { completed: completedChallenge, data };
};

export const refreshChallenges = async (): Promise<DailyChallengesData> => {
  const data = await loadDailyChallenges();
  
  // Only allow 1 refresh per day
  if (data.refreshCount >= 1) {
    return data;
  }
  
  const newData: DailyChallengesData = {
    date: data.date,
    challenges: generateDailyChallenges(),
    refreshCount: data.refreshCount + 1,
  };
  
  await setSetting(CHALLENGES_STORAGE_KEY, newData);
  return newData;
};

// ==================== ACTIVITY HEATMAP ====================

export interface HeatmapData {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export const getActivityHeatmap = async (): Promise<HeatmapData[]> => {
  const xpData = await loadXpData();
  const heatmap: HeatmapData[] = [];
  
  // Generate last 365 days
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = format(date, 'yyyy-MM-dd');
    const count = xpData.xpHistory[dateString] || 0;
    
    // Calculate level (0-4) based on activity
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count > 0) level = 1;
    if (count >= 30) level = 2;
    if (count >= 60) level = 3;
    if (count >= 100) level = 4;
    
    heatmap.push({ date: dateString, count, level });
  }
  
  return heatmap;
};
