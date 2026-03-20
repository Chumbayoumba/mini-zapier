'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRegister } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Loader2, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-handler';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterForm = z.infer<typeof schema>;

export default function RegisterPage() {
  const reg = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: RegisterForm) => {
    setServerError(null);
    reg.mutate(data, {
      onError: (error: unknown) => {
        setServerError(getErrorMessage(error));
      },
    });
  };

  return (
    <div>
      <a href="/" className="flex items-center justify-center gap-2.5 mb-8 lg:hidden hover:opacity-80 transition-opacity">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/25">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">FlowForge</span>
      </a>

      <Card className="border-0 shadow-xl shadow-black/5 dark:shadow-black/30 dark:border dark:border-white/10">
        <CardHeader className="text-center pb-2 pt-8">
          <CardTitle className="text-2xl font-bold">Create your account</CardTitle>
          <CardDescription className="text-sm">Start automating in under a minute</CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
          {serverError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 mb-4">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Full Name</label>
              <Input {...register('name')} placeholder="John Doe" className="h-10" onChange={() => setServerError(null)} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input {...register('email')} type="email" placeholder="you@example.com" className="h-10" onChange={() => setServerError(null)} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <Input {...register('password')} type="password" placeholder="••••••••" className="h-10" onChange={() => setServerError(null)} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message as string}</p>}
            </div>
            <Button type="submit" className="w-full h-10 font-semibold" disabled={reg.isPending}>
              {reg.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</>
              ) : (
                'Create Account'
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By creating an account you agree to our{' '}
              <a href="/terms" className="text-primary hover:text-primary/80 transition-colors">Terms</a>
              {' '}and{' '}
              <a href="/privacy" className="text-primary hover:text-primary/80 transition-colors">Privacy Policy</a>
            </p>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">or</span></div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
