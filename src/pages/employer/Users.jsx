import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users as UsersIcon, Search, Mail, Calendar, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function Users() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const allUsers = await base44.entities.User.list();
        return allUsers.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      } catch {
        return [];
      }
    },
  });

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    owners: users.filter(u => u.role === 'owner').length,
    workers: users.filter(u => ['worker', 'manager', 'payroll_admin'].includes(u.role)).length,
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">View all registered users and signup dates</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <UserCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Owners</CardTitle>
            <UserCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.owners}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workers</CardTitle>
            <UserCheck className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.workers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, name, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? 'No users found matching your search' : 'No users registered yet'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{user.full_name || 'No name'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Badge
                        variant="outline"
                        className={
                          user.role === 'admin'
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : user.role === 'owner'
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-secondary text-secondary-foreground'
                        }
                      >
                        {user.role}
                      </Badge>
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(user.created_date), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}