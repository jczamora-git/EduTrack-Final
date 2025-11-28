import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useNotificationContext } from '@/context/NotificationContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NotificationsPage: React.FC = () => {
  const { notifications, removeNotification } = useNotificationContext();

  const studentNotifications = notifications.filter((n: any) => {
    // show all notifications for students; Filtering logic is intentionally simple
    // NotificationBell already ensures announcements are added appropriately
    return true;
  });

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Notifications</h1>
        {studentNotifications.length === 0 ? (
          <div className="p-6 bg-card border border-border rounded-lg text-center text-muted-foreground">No notifications</div>
        ) : (
          <div className="space-y-3">
            {studentNotifications.map((n: any) => (
              <div key={n.id} className={cn('p-4 rounded-lg border', n.type === 'info' ? 'border-blue-100' : n.type === 'success' ? 'border-green-100' : 'border-red-100')}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{n.title ?? n.message}</p>
                    {n.meta && n.meta.message && <p className="text-sm text-muted-foreground mt-2">{n.meta.message}</p>}
                    <p className="text-xs text-muted-foreground mt-2">{n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => removeNotification(n.id)}>
                      ✕
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NotificationsPage;
