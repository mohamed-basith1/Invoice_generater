export interface InvoiceItem {
  id?: number;
  sNo: number;
  description: string;
  boardThickness?: string;
  size?: string;
  unit: string;
  area: number;
  type: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoiceData {
  customerName: string;
  invoiceNumber: string;
  date: string;
  projectName: string;
  shop: string;
  invoiceType: string;
  format: "INVOICE" | "QUOTATION";
  paidAmount: number;
  discount: number;
  rows: InvoiceItem[];
  totalAmount: number;
  layoutMode?: "new" | "old";
}

export interface StoredInvoice extends InvoiceData {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
}
