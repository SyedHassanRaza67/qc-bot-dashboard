import { Search, UserPlus, Edit, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
}

const UserManagement = () => {
  // Mock data - replace with actual API call
  const users: User[] = [
    { id: "1", name: "John Doe", email: "john@example.com", role: "Admin", status: "active" },
    { id: "2", name: "Jane Smith", email: "jane@example.com", role: "Manager", status: "active" },
    { id: "3", name: "Mike Johnson", email: "mike@example.com", role: "Agent", status: "active" },
    { id: "4", name: "Sarah Williams", email: "sarah@example.com", role: "Agent", status: "inactive" },
    { id: "5", name: "Tom Brown", email: "tom@example.com", role: "Supervisor", status: "active" },
    { id: "6", name: "Emily Davis", email: "emily@example.com", role: "Agent", status: "active" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">User Management</h1>
          <p className="text-muted-foreground">Manage users, roles, and permissions</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name, email, or role..."
              className="pl-10"
            />
          </div>
          <Button className="transition-all duration-200 hover:shadow-md">
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {users.map((user) => (
            <Card key={user.id} className="group hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-semibold">{user.name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Badge variant="secondary">{user.role}</Badge>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        user.status === 'active' ? 'bg-success' : 'bg-muted-foreground'
                      }`}></div>
                      <span className="text-sm text-muted-foreground capitalize">{user.status}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button variant="outline" className="transition-all duration-200 hover:shadow-md">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </main>
    </div>
  );
};

export default UserManagement;
