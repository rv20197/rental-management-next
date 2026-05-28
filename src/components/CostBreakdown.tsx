import React from 'react';

interface CostBreakdownProps {
  baseAmount?: number;
  transportCost?: number;
  labourCost?: number;
  depositAmount?: number;
  showDeposit?: boolean;
  returnLabourCost?: number;
  returnTransportCost?: number;
  damagesCost?: number;
}

const CostBreakdown: React.FC<CostBreakdownProps> = ({
  baseAmount = 0,
  transportCost = 0,
  labourCost = 0,
  depositAmount = 0,
  showDeposit = false,
  returnLabourCost = 0,
  returnTransportCost = 0,
  damagesCost = 0,
}) => {
  const safeBaseAmount = Number(baseAmount) || 0;
  const safeTransportCost = Number(transportCost) || 0;
  const safeLabourCost = Number(labourCost) || 0;
  const safeDepositAmount = Number(depositAmount) || 0;
  const safeReturnLabour = Number(returnLabourCost) || 0;
  const safeReturnTransport = Number(returnTransportCost) || 0;
  const safeDamages = Number(damagesCost) || 0;

  const total =
    safeBaseAmount + safeTransportCost + safeLabourCost + safeReturnLabour + safeReturnTransport + safeDamages;

  const formatCurrency = (value: number) => {
    return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  };

  return (
    <div className="border rounded-md p-4 bg-muted/30">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Base Amount:</span>
          <span>₹{formatCurrency(safeBaseAmount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Transport Cost:</span>
          <span>₹{formatCurrency(safeTransportCost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Labour Cost:</span>
          <span>₹{formatCurrency(safeLabourCost)}</span>
        </div>
        {safeReturnLabour > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Return Labour:</span>
            <span>₹{formatCurrency(safeReturnLabour)}</span>
          </div>
        )}
        {safeReturnTransport > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Return Transport:</span>
            <span>₹{formatCurrency(safeReturnTransport)}</span>
          </div>
        )}
        {safeDamages > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Damages:</span>
            <span>₹{formatCurrency(safeDamages)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 mt-2 border-t font-semibold">
          <span>Total:</span>
          <span>₹{formatCurrency(total)}</span>
        </div>
        {showDeposit && (
          <div className="flex justify-between text-sm mt-2 pt-2 border-t text-blue-600">
            <span>Deposit Collected:</span>
            <span>₹{formatCurrency(safeDepositAmount)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CostBreakdown;
