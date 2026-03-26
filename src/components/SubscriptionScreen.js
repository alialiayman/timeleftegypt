import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNativeApp } from '../contexts/NativeAppContext';

/**
 * PricingPlanCard — reusable card for a subscription plan.
 */
function PricingPlanCard({ plan, selected, onSelect, promoDiscount }) {
  const discountedPrice = promoDiscount > 0
    ? plan.price * (1 - promoDiscount / 100)
    : plan.price;
  const weeklyPrice = discountedPrice / plan.weeks;
  const originalTotal = plan.price;

  // Savings vs 1-month repeated
  const savingsAmount = plan.monthlyEquivalent
    ? plan.monthlyEquivalent * plan.months - discountedPrice
    : 0;
  const savingsPct = plan.monthlyEquivalent && plan.monthlyEquivalent > 0
    ? Math.round((savingsAmount / (plan.monthlyEquivalent * plan.months)) * 100)
    : 0;

  const isActive = selected;

  return (
    <Pressable
      style={[styles.planCard, isActive && styles.planCardActive]}
      onPress={() => onSelect(plan.key)}
      accessibilityRole="radio"
      accessibilityState={{ checked: isActive }}
    >
      <View style={styles.planLeft}>
        <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
          {isActive && <View style={styles.radioInner} />}
        </View>
        <View style={styles.planInfo}>
          <Text style={[styles.planName, isActive && styles.planNameActive]}>{plan.label}</Text>
          <View style={styles.planPriceRow}>
            {promoDiscount > 0 && (
              <Text style={styles.planOriginalPrice}>
                {originalTotal.toFixed(2)} {plan.currency}
              </Text>
            )}
            <Text style={[styles.planPrice, isActive && styles.planPriceActive]}>
              {discountedPrice.toFixed(2)} {plan.currency}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.planRight}>
        {savingsPct > 0 && (
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsText}>Save {savingsPct}%</Text>
          </View>
        )}
        <Text style={[styles.weeklyPrice, isActive && styles.weeklyPriceActive]}>
          {weeklyPrice.toFixed(2)} {plan.currency}/week
        </Text>
      </View>
    </Pressable>
  );
}

export default function SubscriptionScreen({ onBack }) {
  const { db } = useNativeApp();
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('1month');
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);

  useEffect(() => {
    const loadPricing = async () => {
      if (!db) return;
      try {
        const snap = await getDoc(doc(db, 'settings', 'subscriptionPricing'));
        if (snap.exists()) {
          setPricing(snap.data());
        } else {
          // Fallback defaults
          setPricing({ price1Month: 0, price3Month: 0, price6Month: 0, currency: 'EGP', promoCodes: [] });
        }
      } catch (err) {
        console.error('Load subscription pricing failed:', err);
        setPricing({ price1Month: 0, price3Month: 0, price6Month: 0, currency: 'EGP', promoCodes: [] });
      } finally {
        setLoading(false);
      }
    };
    loadPricing();
  }, [db]);

  const plans = useMemo(() => {
    if (!pricing) return [];
    const currency = pricing.currency || 'EGP';
    const p1 = Number(pricing.price1Month || 0);
    const p3 = Number(pricing.price3Month || 0);
    const p6 = Number(pricing.price6Month || 0);
    return [
      {
        key: '1month',
        label: '1 Month',
        price: p1,
        months: 1,
        weeks: 4,
        currency,
        monthlyEquivalent: null,
      },
      {
        key: '3month',
        label: '3 Months',
        price: p3,
        months: 3,
        weeks: 13,
        currency,
        monthlyEquivalent: p1,
      },
      {
        key: '6month',
        label: '6 Months',
        price: p6,
        months: 6,
        weeks: 26,
        currency,
        monthlyEquivalent: p1,
      },
    ];
  }, [pricing]);

  const applyPromoCode = () => {
    setPromoError('');
    const code = promoCode.trim().toLowerCase();
    if (!code) {
      setPromoError('Please enter a promo code.');
      return;
    }
    const allCodes = pricing?.promoCodes || [];
    const match = allCodes.find((pc) => (pc.code || '').toLowerCase() === code);
    if (!match) {
      setPromoError('Invalid promo code.');
      setPromoDiscount(0);
      setPromoApplied(false);
      return;
    }
    const discount = Number(match.discount || 0);
    setPromoDiscount(discount);
    setPromoApplied(true);
    setPromoError('');
  };

  const handleSubscribe = () => {
    // TODO: Integrate payment processor before going live.
    // Required steps:
    //   1. Choose a provider (Stripe, Paymob, Fawry, etc.)
    //   2. Create a checkout session on your backend with: planKey, userId, price, currency
    //   3. Pass the checkout URL/session to a payment sheet or WebView
    //   4. On completion/webhook, write subscription record to Firestore: users/{uid}/subscriptions
    //   5. Update user status and subscription expiry date
    Alert.alert(
      'Coming soon',
      'Payment integration is not yet active. Your selected plan has been noted.',
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2EDC9A" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      {onBack && (
        <Pressable style={styles.backButton} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1F2937" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      )}

      <Text style={styles.title}>Choose Your Plan</Text>
      <Text style={styles.subtitle}>Get full access to all events and features.</Text>

      {/* Plan cards */}
      {plans.map((plan) => (
        <PricingPlanCard
          key={plan.key}
          plan={plan}
          selected={selectedPlan === plan.key}
          onSelect={setSelectedPlan}
          promoDiscount={promoDiscount}
        />
      ))}

      {/* Promo code section */}
      <View style={styles.promoCard}>
        <Text style={styles.promoQuestion}>Got a promo code?</Text>
        <View style={styles.promoInputRow}>
          <MaterialCommunityIcons name="ticket-percent-outline" size={20} color="#6B7280" style={styles.promoIcon} />
          <TextInput
            style={styles.promoInput}
            value={promoCode}
            onChangeText={(v) => { setPromoCode(v); setPromoApplied(false); setPromoError(''); }}
            placeholder="Enter here"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable style={styles.promoApplyButton} onPress={applyPromoCode}>
            <Text style={styles.promoApplyText}>Apply</Text>
          </Pressable>
        </View>
        {promoError ? <Text style={styles.promoError}>{promoError}</Text> : null}
        {promoApplied ? (
          <Text style={styles.promoSuccess}>{promoDiscount}% discount applied!</Text>
        ) : null}
      </View>

      {/* Subscribe CTA */}
      <Pressable style={styles.subscribeButton} onPress={handleSubscribe}>
        <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
      </Pressable>
      {/* TODO: Integrate payment processor (Stripe / Paymob) before going live */}
      <Text style={styles.paymentNote}>Secure payment. Cancel anytime.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: '#FAFAF7',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  backText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  planCardActive: {
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#1F2937',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#1F2937',
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  planNameActive: {
    color: '#111827',
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planOriginalPrice: {
    fontSize: 13,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  planPrice: {
    fontSize: 14,
    color: '#6B7280',
  },
  planPriceActive: {
    color: '#1F2937',
    fontWeight: '600',
  },
  planRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  savingsBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  weeklyPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
  },
  weeklyPriceActive: {
    color: '#111827',
    fontSize: 17,
  },
  promoCard: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    alignItems: 'center',
  },
  promoQuestion: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 10,
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  promoIcon: {
    marginRight: 2,
  },
  promoInput: {
    flex: 1,
    borderWidth: 0,
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '700',
    textDecorationLine: 'underline',
    paddingVertical: 4,
  },
  promoApplyButton: {
    backgroundColor: '#2EDC9A',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  promoApplyText: {
    color: '#0B5D40',
    fontWeight: '700',
    fontSize: 13,
  },
  promoError: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  promoSuccess: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '700',
    marginTop: 6,
  },
  subscribeButton: {
    backgroundColor: '#1F2937',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
