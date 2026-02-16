import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Star, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadXpData, XpData, getLevelTitle } from '@/utils/gamificationStorage';
import { playLevelUpSound } from '@/utils/gamificationSounds';

import Confetti from 'react-confetti';

interface XpLevelProgressProps {
  compact?: boolean;
}

export const XpLevelProgress = ({ compact = false }: XpLevelProgressProps) => {
  const { t } = useTranslation();
  const [xpData, setXpData] = useState<XpData | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const data = await loadXpData();
      setXpData(data);
    };
    loadData();

    const handleXpUpdate = () => loadData();
    const handleLevelUp = async (e: CustomEvent<{ level: number }>) => {
      const level = e.detail.level;
      const title = getLevelTitle(level);
      
      setNewLevel(level);
      setShowLevelUp(true);
      setShowConfetti(true);
      
      // Play sound effect
      playLevelUpSound();
      
      // Level up!
      
      setTimeout(() => {
        setShowLevelUp(false);
        setShowConfetti(false);
      }, 4000);
      loadData();
    };

    window.addEventListener('xpUpdated', handleXpUpdate);
    window.addEventListener('levelUp', handleLevelUp as EventListener);
    return () => {
      window.removeEventListener('xpUpdated', handleXpUpdate);
      window.removeEventListener('levelUp', handleLevelUp as EventListener);
    };
  }, []);

  if (!xpData) return null;

  const progressPercent = (xpData.xpInCurrentLevel / xpData.xpToNextLevel) * 100;
  const levelTitle = getLevelTitle(xpData.currentLevel);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-4 border"
      >
        <div className="flex items-center gap-3">
          {/* Level Badge */}
          <div className="relative">
             <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-purple to-accent-indigo flex items-center justify-center shadow-lg">
              <span className="text-xl font-bold text-accent-purple-foreground">{xpData.currentLevel}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 bg-warning rounded-full p-1">
              <Star className="h-3 w-3 text-warning-foreground fill-warning-foreground" />
            </div>
          </div>

          {/* Level Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">{levelTitle}</span>
              <span className="text-xs text-muted-foreground">Lvl {xpData.currentLevel}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="relative">
              <div className="w-full bg-muted rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-2 rounded-full bg-gradient-to-r from-accent-purple to-accent-indigo"
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{xpData.xpInCurrentLevel} XP</span>
                <span className="text-[10px] text-muted-foreground">{xpData.xpToNextLevel} XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily XP */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <TrendingUp className="h-4 w-4 text-success" />
          <span className="text-xs text-muted-foreground">
            {t('xp.earnedToday', 'Today')}: <span className="font-semibold text-foreground">+{xpData.dailyXpEarned} XP</span>
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Confetti for level up */}
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={300}
          gravity={0.3}
          colors={['hsl(var(--accent-purple))', 'hsl(var(--accent-indigo))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--accent-pink))']}
        />
      )}

      {/* Level Up Celebration */}
      <AnimatePresence>
        {showLevelUp && newLevel && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50, rotateY: -90 }}
              animate={{ y: 0, rotateY: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              className="text-center"
            >
              {/* Animated stars */}
              <div className="relative">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ 
                      opacity: [0, 1, 0], 
                      scale: [0, 1.5, 0],
                      x: [0, (Math.random() - 0.5) * 200],
                      y: [0, (Math.random() - 0.5) * 200],
                    }}
                    transition={{ duration: 1.5, delay: i * 0.1, repeat: 2 }}
                    className="absolute top-1/2 left-1/2"
                  >
                    <Sparkles className="h-6 w-6 text-warning" />
                  </motion.div>
                ))}
                
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0],
                  }}
                  transition={{ duration: 0.5, repeat: 3 }}
                >
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-accent-purple to-accent-indigo flex items-center justify-center shadow-2xl mx-auto">
                    <span className="text-5xl font-bold text-accent-purple-foreground">{newLevel}</span>
                  </div>
                </motion.div>
              </div>
              
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-bold mt-6 bg-gradient-to-r from-accent-purple via-accent-pink to-accent-indigo bg-clip-text text-transparent"
              >
                Level {newLevel}!
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-2xl text-foreground mt-2 font-semibold"
              >
                {getLevelTitle(newLevel)}
              </motion.p>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-muted-foreground mt-2"
              >
                {t('xp.levelUpCongrats', 'Keep going, champion! 🏆')}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-6 border"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-warning fill-warning" />
            {t('xp.level', 'Level')} & XP
          </h3>
          <span className="text-sm font-bold text-accent-purple">{xpData.totalXp.toLocaleString()} XP</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Level Circle */}
          <div className="relative flex-shrink-0">
             <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-purple to-accent-indigo flex items-center justify-center shadow-xl">
              <span className="text-3xl font-bold text-accent-purple-foreground">{xpData.currentLevel}</span>
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border-2 border-dashed border-accent-purple/30"
            />
          </div>

          {/* Level Details */}
          <div className="flex-1">
            <p className="font-semibold text-lg">{levelTitle}</p>
            <p className="text-sm text-muted-foreground mb-2">
              {t('xp.nextLevel', 'Next level in')} {(xpData.xpToNextLevel - xpData.xpInCurrentLevel).toLocaleString()} XP
            </p>
            
            {/* Progress Bar */}
            <div className="relative">
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-3 rounded-full bg-gradient-to-r from-accent-purple via-accent-indigo to-accent-purple relative"
                >
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  />
                </motion.div>
              </div>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">{xpData.xpInCurrentLevel.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">{xpData.xpToNextLevel.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Daily Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{t('xp.earnedToday', 'Today')}</p>
            <p className="text-lg font-bold text-success">+{xpData.dailyXpEarned}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{t('xp.totalXp', 'Total XP')}</p>
            <p className="text-lg font-bold text-accent-purple">{xpData.totalXp.toLocaleString()}</p>
          </div>
        </div>
      </motion.div>
    </>
  );
};
