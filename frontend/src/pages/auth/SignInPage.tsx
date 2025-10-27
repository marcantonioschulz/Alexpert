import { SignIn } from '@clerk/clerk-react';

export function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Alexpert</h1>
          <p className="mt-2 text-gray-600">Sign in to your account to continue</p>
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          forceRedirectUrl="/"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'shadow-xl'
            }
          }}
        />
      </div>
    </div>
  );
}
