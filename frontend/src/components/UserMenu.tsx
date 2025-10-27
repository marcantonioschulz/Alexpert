import { UserButton, OrganizationSwitcher } from '@clerk/clerk-react';

export function UserMenu() {
  return (
    <div className="flex items-center gap-4">
      {/* Organization Switcher */}
      <div className="hidden md:block">
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              rootBox: 'flex items-center',
              organizationSwitcherTrigger:
                'px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400 transition-colors',
              organizationSwitcherTriggerIcon: 'text-gray-600',
              organizationPreview: 'text-gray-900'
            }
          }}
        />
      </div>

      {/* User Button */}
      <UserButton
        afterSignOutUrl="/sign-in"
        appearance={{
          elements: {
            avatarBox: 'w-10 h-10'
          }
        }}
      />
    </div>
  );
}
