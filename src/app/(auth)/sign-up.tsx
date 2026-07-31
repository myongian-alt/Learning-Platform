import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { signUpWithPassword } from '@/lib/auth-actions';
import type { UserRole } from '@/types/database';

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signUpWithPassword(email, password, fullName, role);
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
          <Text className="text-3xl font-bold text-ink">Create your account</Text>
          <Text className="text-base text-ink/60">Teachers and students both start here.</Text>
        </View>

        {error && (
          <View className="rounded-xl bg-red-100 px-4 py-3">
            <Text className="text-sm text-red-900">{error}</Text>
          </View>
        )}

        <View className="flex-row gap-2 rounded-xl bg-black/5 p-1">
          {(['student', 'teacher'] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setRole(option)}
              className={`flex-1 items-center rounded-lg py-2.5 ${
                role === option ? 'bg-white shadow-sm' : ''
              }`}
            >
              <Text
                className={`text-sm font-semibold capitalize ${
                  role === option ? 'text-brand-600' : 'text-ink/50'
                }`}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="gap-4">
          <TextField
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ada Lovelace"
          />
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
            textContentType="newPassword"
            placeholder="At least 8 characters"
          />
        </View>

        <Button label="Create account" onPress={handleSignUp} isLoading={isLoading} />

        <Link href="/(auth)/sign-in" className="text-center text-sm text-brand-600">
          Already have an account? Sign in
        </Link>
      </View>
    </View>
  );
}
