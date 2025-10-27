import { SignUp } from '@clerk/clerk-react';

export function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Join Alexpert</h1>
          <p className="mt-2 text-gray-600">Create your account to get started</p>
        </div>
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          afterSignUpUrl="/"
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
