import { useState, useEffect } from "react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  Ticket,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Redemption {
  id: number;
  pointsSpent: number;
  redemptionCode: string;
  status: string;
  collectedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
  reward: {
    id: number;
    name: string;
    category: string;
    pointsCost: number;
  };
}

export default function AdminRedemptionsPage() {
  const navigate = useNavigate();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [collectDialogOpen, setCollectDialogOpen] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null);
  const [collecting, setCollecting] = useState(false);

  useEffect(() => {
    fetchRedemptions();
  }, []);

  const fetchRedemptions = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/v1/admin/redemptions", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setRedemptions(data);
      }
    } catch (err) {
      console.error("Failed to fetch redemptions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async () => {
    if (!selectedRedemption) return;

    setCollecting(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/v1/admin/redemptions/${selectedRedemption.id}/collect`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        await fetchRedemptions();
        setCollectDialogOpen(false);
        setSelectedRedemption(null);
      }
    } catch (err) {
      console.error("Failed to mark as collected:", err);
    } finally {
      setCollecting(false);
    }
  };

  const openCollectDialog = (redemption: Redemption) => {
    setSelectedRedemption(redemption);
    setCollectDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "collected":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Collected
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-300">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredRedemptions = redemptions.filter((r) => {
    const matchesSearch =
      searchCode === "" ||
      r.redemptionCode.toLowerCase().includes(searchCode.toLowerCase()) ||
      r.user.name.toLowerCase().includes(searchCode.toLowerCase()) ||
      r.user.email.toLowerCase().includes(searchCode.toLowerCase());

    const matchesStatus = statusFilter === "all" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Redemption Records</h1>
          <p className="text-muted-foreground">View and manage all redemptions</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by code, user name, or email..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="collected">Collected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Redemptions Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRedemptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchCode || statusFilter !== "all"
                    ? "No redemptions match your filters."
                    : "No redemptions found."}
                </TableCell>
              </TableRow>
            ) : (
              filteredRedemptions.map((redemption) => (
                <TableRow key={redemption.id}>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                      {redemption.redemptionCode}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{redemption.user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {redemption.user.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {redemption.reward.category === "physical" ? (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Ticket className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{redemption.reward.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {redemption.pointsSpent.toLocaleString()}
                  </TableCell>
                  <TableCell>{getStatusBadge(redemption.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(redemption.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {redemption.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCollectDialog(redemption)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Collect
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {redemptions.filter((r) => r.status === "pending").length}
          </p>
          <p className="text-sm text-muted-foreground">Pending</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {redemptions.filter((r) => r.status === "collected").length}
          </p>
          <p className="text-sm text-muted-foreground">Collected</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-500">
            {redemptions.filter((r) => r.status === "expired").length}
          </p>
          <p className="text-sm text-muted-foreground">Expired</p>
        </Card>
      </div>

      {/* Collect Confirmation Dialog */}
      <Dialog open={collectDialogOpen} onOpenChange={setCollectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Collected</DialogTitle>
            <DialogDescription>
              Confirm that this redemption has been collected by the user.
            </DialogDescription>
          </DialogHeader>

          {selectedRedemption && (
            <div className="py-4 space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-muted-foreground">Redemption Code:</p>
                  <p className="font-mono font-bold">
                    {selectedRedemption.redemptionCode}
                  </p>
                  <p className="text-muted-foreground">User:</p>
                  <p>{selectedRedemption.user.name}</p>
                  <p className="text-muted-foreground">Reward:</p>
                  <p>{selectedRedemption.reward.name}</p>
                  <p className="text-muted-foreground">Points Spent:</p>
                  <p>{selectedRedemption.pointsSpent.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCollectDialogOpen(false)}
              disabled={collecting}
            >
              Cancel
            </Button>
            <Button onClick={handleCollect} disabled={collecting}>
              {collecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Collection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
