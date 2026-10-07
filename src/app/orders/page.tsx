"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { formatSharePrice, formatDate } from "@/lib/formatters";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, XCircle, AlertCircle, Layers, ArrowUpRight } from "lucide-react";
import type { OrderItem } from "@/types";

export default function OrdersPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    try {
      const url =
        statusFilter === "ALL"
          ? `/api/trade/orders?userId=${user.id}`
          : `/api/trade/orders?userId=${user.id}&status=${statusFilter}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchOrders();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleCancel = async (orderId: string) => {
    if (!user) return;
    setCancellingId(orderId);
    try {
      const res = await fetch(`/api/trade/orders/${orderId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setFeedback(`Order ${orderId} successfully cancelled.`);
        await refreshUser();
        await fetchOrders();
        setTimeout(() => setFeedback(null), 3000);
      } else {
        setFeedback(json.message || "Failed to cancel order.");
      }
    } catch (err) {
      console.error("Cancel order error:", err);
    } finally {
      setCancellingId(null);
    }
  };

  if (!user) {
    return (
      <div className="py-20 text-center space-y-4">
        <Clock className="h-12 w-12 text-zinc-500 mx-auto" />
        <h2 className="text-xl font-bold text-white">Authentication Required</h2>
        <p className="text-xs font-mono text-zinc-400">Please sign in to view your orders book.</p>
        <Link href="/" prefetch={true} className="inline-block px-4 py-2 rounded-xl bg-emerald-500 text-black font-mono font-bold text-xs">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-4 sm:pb-6">
        <div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Order History</h1>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            Real-time audit log of your open quotes, filled executions, and cancellations.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono text-xs font-bold">
          {feedback}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4">
        {["ALL", "OPEN", "COMPLETED", "CANCELLED"].map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-4 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
              statusFilter === f
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "border border-white/10 bg-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      {orders.length > 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#060911]/80 backdrop-blur-2xl overflow-hidden shadow-xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Order Price</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Filled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((ord) => (
                <TableRow key={ord.id} className="border-white/5 hover:bg-white/[0.02]">
                  <TableCell className="font-mono text-xs font-bold text-cyan-400">{ord.id}</TableCell>
                  <TableCell className="font-bold text-white">
                    <Link href={`/startup/${ord.startupSlug}`} prefetch={true} className="hover:text-cyan-400 flex items-center gap-1.5">
                      {ord.startupName}
                      <ArrowUpRight className="h-3 w-3 text-zinc-500" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
                        ord.side === "BUY"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {ord.side}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-400">{ord.type}</TableCell>
                  <TableCell className="font-mono font-bold text-white">{formatSharePrice(ord.price)}</TableCell>
                  <TableCell className="font-mono text-white">{ord.quantity}</TableCell>
                  <TableCell className="font-mono text-zinc-300">
                    {ord.filledQuantity} / {ord.quantity}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                        ord.status === "FILLED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : ord.status === "OPEN" || ord.status === "PARTIALLY_FILLED"
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          : "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30"
                      }`}
                    >
                      {ord.status}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-zinc-400">{formatDate(ord.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    {(ord.status === "OPEN" || ord.status === "PARTIALLY_FILLED") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cancellingId === ord.id}
                        onClick={() => handleCancel(ord.id)}
                        className="h-8 px-3 rounded-lg font-mono text-xs border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                      >
                        {cancellingId === ord.id ? "Cancelling..." : "Cancel"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card className="glass-panel-premium p-12 text-center text-xs font-mono text-zinc-500 border-white/10 space-y-2">
          <Layers className="h-8 w-8 mx-auto text-zinc-600" />
          <p>No orders found matching the filter.</p>
        </Card>
      )}
    </div>
  );
}
