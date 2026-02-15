import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Crown, Unlock, Bell, Loader2 } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Capacitor } from '@capacitor/core';
import { triggerHaptic } from '@/utils/haptics';
import { PRICING_DISPLAY } from '@/lib/billing';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

export const PremiumPaywall = () => {
  const { t } = useTranslation();
  const { showPaywall, closePaywall, unlockPro } = useSubscription();
  const [plan, setPlan] = useState<'weekly' | 'monthly' | 'lifetime'>('weekly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminError, setAdminError] = useState('');

  useHardwareBackButton({
    onBack: () => { closePaywall(); },
    enabled: showPaywall,
    priority: 'sheet',
  });

  if (!showPaywall) return null;

  const weeklyPrice = '$2.99/wk';
  const monthlyPrice = '$5.99/mo';
  const lifetimePrice = '$79.99';

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const { Purchases, PACKAGE_TYPE } = await import('@revenuecat/purchases-capacitor');
        const offerings = await Purchases.getOfferings();
        
        if (!offerings?.current) throw new Error('No offerings available');
        
        const packageType = plan === 'monthly' 
          ? PACKAGE_TYPE.MONTHLY 
          : plan === 'weekly' 
            ? PACKAGE_TYPE.WEEKLY 
            : PACKAGE_TYPE.LIFETIME;
        
        let pkg = offerings.current.availablePackages.find(p => p.packageType === packageType);
        if (!pkg) pkg = offerings.current.availablePackages.find(p => p.identifier === plan);
        if (!pkg) throw new Error('Package not found');
        
        const result = await Purchases.purchasePackage({ aPackage: pkg });
        const hasEntitlement = result.customerInfo.entitlements.active['npd Pro'] !== undefined;
        
        if (hasEntitlement) {
          await unlockPro();
        }
      } else {
        // Web fallback
        await unlockPro();
      }
    } catch (error: any) {
      if (error.code !== 'PURCHASE_CANCELLED' && !error.userCancelled) {
        console.error('Purchase failed:', error);
        setAdminError('Purchase failed. Please try again.');
        setTimeout(() => setAdminError(''), 3000);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const { Purchases } = await import('@revenuecat/purchases-capacitor');
        const { customerInfo } = await Purchases.restorePurchases();
        const hasEntitlement = customerInfo.entitlements.active['npd Pro'] !== undefined;
        if (hasEntitlement) {
          await unlockPro();
        } else {
          setAdminError('No purchases found');
          setTimeout(() => setAdminError(''), 3000);
        }
      } else {
        // Web fallback - no restore available on web
        setAdminError('No purchases found');
        setTimeout(() => setAdminError(''), 3000);
      }
    } catch (error) {
      console.error('Restore failed:', error);
      setAdminError('Restore failed');
      setTimeout(() => setAdminError(''), 3000);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleAccessCode = async () => {
    const validCode = 'BUGTI';
    if (adminCode.trim().toUpperCase() === validCode) {
      const { setSetting } = await import('@/utils/settingsStorage');
      await setSetting('npd_admin_bypass', true);
      await unlockPro();
    } else {
      setAdminError('Invalid access code');
      setAdminCode('');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
      {/* Close button */}
      <div className="flex justify-end px-4 py-2">
        <button onClick={closePaywall} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        <h1 className="text-3xl font-bold text-center mb-6">Upgrade to Pro</h1>
        
        {/* Feature timeline */}
        <div className="flex flex-col items-start mx-auto w-80 relative">
          <div className="absolute left-[10.5px] top-[20px] bottom-[20px] w-[11px] bg-primary/20 rounded-b-full"></div>

          <div className="flex items-start gap-3 mb-6 relative">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground z-10 flex-shrink-0">
              <Unlock size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold">Unlock All Features</p>
              <p className="text-gray-500 text-sm">Dark mode, templates, sync, and more</p>
            </div>
          </div>
          <div className="flex items-start gap-3 mb-6 relative">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground z-10 flex-shrink-0">
              <Bell size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold">Unlimited Everything</p>
              <p className="text-gray-500 text-sm">Unlimited folders, sections, and views</p>
            </div>
          </div>
          <div className="flex items-start gap-3 relative">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground z-10 flex-shrink-0">
              <Crown size={16} strokeWidth={2} />
            </div>
            <div>
              <p className="font-semibold">Pro Member</p>
              <p className="text-gray-500 text-sm">Get access to all current and future features</p>
            </div>
          </div>
        </div>

        {/* Plan selection */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="flex gap-2 justify-center w-full">
            <button 
              onClick={() => { triggerHaptic('heavy'); setPlan('weekly'); }} 
              className={`border-2 rounded-xl p-3 flex-1 text-center relative flex flex-col items-center justify-center min-h-[70px] ${plan === 'weekly' ? 'border-[#3c78f0]' : 'border-gray-200'}`}
            >
              <p className="font-bold text-sm">Weekly</p>
              <p className="text-gray-600 text-xs mt-0.5">{weeklyPrice}</p>
            </button>

            <button 
              onClick={() => { triggerHaptic('heavy'); setPlan('monthly'); }} 
              className={`border-2 rounded-xl p-3 flex-1 text-center relative flex flex-col items-center justify-center min-h-[70px] ${plan === 'monthly' ? 'border-[#3c78f0] bg-gray-50' : 'border-gray-200'}`}
            >
              <p className="font-bold text-sm">Monthly</p>
              <p className="text-gray-600 text-xs mt-0.5">{monthlyPrice}</p>
            </button>

            <button 
              onClick={() => { triggerHaptic('heavy'); setPlan('lifetime'); }} 
              className={`border-2 rounded-xl p-3 flex-1 text-center relative flex flex-col items-center justify-center min-h-[70px] ${plan === 'lifetime' ? 'border-[#3c78f0]' : 'border-gray-200'}`}
            >
              <span className="bg-[#3c78f0] text-white text-[10px] px-2 py-0.5 rounded-full absolute left-1/2 -translate-x-1/2 -top-2.5 whitespace-nowrap font-medium">
                BEST VALUE
              </span>
              <p className="font-bold text-sm">Lifetime</p>
              <p className="text-gray-600 text-xs mt-0.5">{lifetimePrice}</p>
            </button>
          </div>

          {plan === 'lifetime' && (
            <p className="text-gray-400 text-xs text-center max-w-xs mt-2">
              One-time payment. Does not include Location Based Reminders or future API features.
            </p>
          )}

          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-80 mt-4 btn-duo disabled:opacity-50"
            >
              {isPurchasing ? 'Processing...' : (
                plan === 'weekly' ? `Continue with ${weeklyPrice}` :
                plan === 'monthly' ? `Continue with ${monthlyPrice}` :
                `Get Lifetime for ${lifetimePrice}`
              )}
            </button>

            <button 
              onClick={handleRestore}
              disabled={isRestoring}
              className="text-primary font-medium text-sm mt-2 disabled:opacity-50"
            >
              {isRestoring ? 'Restoring...' : 'Restore Purchase'}
            </button>

            {/* Access Code */}
            <div className="mt-6 w-full">
              {!showAdminInput ? (
                <button 
                  onClick={() => setShowAdminInput(true)}
                  className="text-gray-400 text-xs underline"
                >
                  Have an access code?
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2 w-full max-w-xs">
                    <input
                      type="password"
                      value={adminCode}
                      onChange={(e) => {
                        setAdminCode(e.target.value.slice(0, 20));
                        setAdminError('');
                      }}
                      placeholder="Enter access code"
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-center text-sm focus:outline-none focus:border-primary"
                      maxLength={20}
                    />
                    <button
                      onClick={handleAccessCode}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                    >
                      Apply
                    </button>
                  </div>
                  {adminError && (
                    <p className="text-red-500 text-xs">{adminError}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
