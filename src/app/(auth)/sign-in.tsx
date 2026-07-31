import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { signInWithPassword } from '@/lib/auth-actions';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithPassword(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-paper px-6">
      <View className="w-full max-w-sm gap-6">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-ink">Penbook</Text>
          <Text className="text-base text-ink/60">Sign in to your classroom.</Text>
        </View>

        {!isSupabaseConfigured && (
          <View className="rounded-xl bg-amber-100 px-4 py-3">
            <Text className="text-sm text-amber-900">
              Supabase isn&apos;t configured yet. Add EXPO_PUBLIC_SUPABASE_URL and
              EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local — see README.
            </Text>
          </View>
        )}

        {error && (
          <View className="rounded-xl bg-red-100 px-4 py-3">
            <Text className="text-sm text-red-900">{error}</Text>
          </View>
        )}

        <View className="gap-4">
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@school.edu"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="••••••••"
          />
        </View>

        <Button label="Sign in" onPress={handleSignIn} isLoading={isLoading} />

        <Link href="/(auth)/sign-up" className="text-center text-sm text-brand-600">
          Don&apos;t have an account? Create one
        </Link>
      </View>
    </View>
  );
}
