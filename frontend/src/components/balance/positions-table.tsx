import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBalanceStore } from "@/store/use-balance-store";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PositionsTable() {
  const { positions } = useBalanceStore();

  if (!positions.length) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No active positions
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Symbol</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Entry Price</TableHead>
            <TableHead>Current Price</TableHead>
            <TableHead>P&L</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.orderId}>
              <TableCell className="font-medium">{position.symbol}</TableCell>
              <TableCell>{position.quantity}</TableCell>
              <TableCell>{formatCurrency(position.averagePrice)}</TableCell>
              <TableCell>{formatCurrency(position.currentPrice)}</TableCell>
              <TableCell
                className={
                  position.pnl >= 0 ? "text-green-600" : "text-red-600"
                }
              >
                {formatCurrency(Math.abs(position.pnl))}
                <span className="text-xs ml-1">
                  {position.pnl >= 0 ? "+" : "-"}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{position.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
