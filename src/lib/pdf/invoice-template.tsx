import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { InvoiceLineItem, GSTBreakup } from "@/types/invoices";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  companyName: { fontSize: 14, fontWeight: "bold", color: "#1a1a1a" },
  companyDetails: { fontSize: 8, color: "#666", marginTop: 2 },
  invoiceTitle: { fontSize: 16, fontWeight: "bold", textAlign: "right" },
  invoiceNumber: { fontSize: 9, color: "#666", marginTop: 3, textAlign: "right" },
  billTo: { backgroundColor: "#f5f5f5", padding: 12, borderRadius: 4, marginTop: 15 },
  billToLabel: { fontSize: 7, fontWeight: "bold", color: "#999", marginBottom: 4 },
  clientName: { fontSize: 11, fontWeight: "bold" },
  clientDetail: { fontSize: 8, color: "#666", marginTop: 1 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 6,
    marginTop: 20,
    fontSize: 7,
    fontWeight: "bold",
    color: "#666",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
    borderStyle: "dashed",
    paddingVertical: 6,
  },
  colNum: { width: "5%" },
  colDesc: { width: "35%" },
  colSac: { width: "15%" },
  colQty: { width: "10%", textAlign: "right" },
  colRate: { width: "15%", textAlign: "right" },
  colAmount: { width: "20%", textAlign: "right" },
  totalsContainer: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
  totalsBox: { width: 200 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 8,
  },
  totalRowBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: "#333",
    marginTop: 4,
    fontSize: 10,
    fontWeight: "bold",
  },
  amountWords: {
    marginTop: 12,
    fontSize: 8,
    fontStyle: "italic",
    color: "#666",
    textAlign: "right",
  },
  notes: {
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 4,
    marginTop: 20,
  },
  notesLabel: { fontSize: 7, fontWeight: "bold", color: "#999", marginBottom: 3 },
  notesText: { fontSize: 8 },
  bankSection: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 12,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bankLabel: { fontSize: 7, fontWeight: "bold", color: "#999", marginBottom: 4 },
  bankDetail: { fontSize: 8, color: "#666", marginTop: 1 },
  qrCode: { width: 120, height: 120 },
  qrLabel: { fontSize: 7, color: "#999", marginTop: 3, textAlign: "center" },
});

interface InvoicePDFProps {
  invoiceNumber: string;
  createdAt: string;
  dueDate?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientCompany?: string | null;
  clientGst?: string | null;
  clientState?: string | null;
  items: InvoiceLineItem[];
  gst: GSTBreakup;
  notes?: string | null;
  amountInWords: string;
  qrCodeDataUrl?: string;
}

function fmtCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function InvoicePDF({
  invoiceNumber,
  createdAt,
  dueDate,
  clientName,
  clientEmail,
  clientPhone,
  clientCompany,
  clientGst,
  clientState,
  items,
  gst,
  notes,
  amountInWords,
  qrCodeDataUrl,
}: InvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>EXPWAVE PVT. LTD.</Text>
            <Text style={styles.companyDetails}>
              328, 6th main AECS B Block Singasandra Bangalore 560068
            </Text>
            <Text style={styles.companyDetails}>
              GSTIN: 29AAHCE9805F1ZE | PAN: AAHCE9805F
            </Text>
            <Text style={styles.companyDetails}>State: Karnataka (29)</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
            <Text style={styles.invoiceNumber}>Date: {fmtDate(createdAt)}</Text>
            {dueDate && (
              <Text style={styles.invoiceNumber}>Due: {fmtDate(dueDate)}</Text>
            )}
          </View>
        </View>

        {/* Bill To */}
        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>BILL TO</Text>
          <Text style={styles.clientName}>{clientName}</Text>
          {clientCompany && <Text style={styles.clientDetail}>{clientCompany}</Text>}
          {clientEmail && <Text style={styles.clientDetail}>{clientEmail}</Text>}
          {clientPhone && <Text style={styles.clientDetail}>{clientPhone}</Text>}
          {clientGst && <Text style={styles.clientDetail}>GSTIN: {clientGst}</Text>}
          {clientState && <Text style={styles.clientDetail}>State: {clientState}</Text>}
        </View>

        {/* Items Table */}
        <View style={styles.tableHeader}>
          <Text style={styles.colNum}>#</Text>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colSac}>SAC</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.colNum}>{i + 1}</Text>
            <Text style={styles.colDesc}>{item.description}</Text>
            <Text style={styles.colSac}>{item.sac_code}</Text>
            <Text style={styles.colQty}>{item.qty}</Text>
            <Text style={styles.colRate}>{fmtCurrency(item.rate)}</Text>
            <Text style={styles.colAmount}>{fmtCurrency(item.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Subtotal</Text>
              <Text>{fmtCurrency(gst.subtotal)}</Text>
            </View>
            {gst.isIntraState ? (
              <>
                <View style={styles.totalRow}>
                  <Text>CGST ({gst.gstRate / 2}%)</Text>
                  <Text>{fmtCurrency(gst.cgst)}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text>SGST ({gst.gstRate / 2}%)</Text>
                  <Text>{fmtCurrency(gst.sgst)}</Text>
                </View>
              </>
            ) : gst.igst > 0 ? (
              <View style={styles.totalRow}>
                <Text>IGST ({gst.gstRate}%)</Text>
                <Text>{fmtCurrency(gst.igst)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRowBold}>
              <Text>Total</Text>
              <Text>{fmtCurrency(gst.total)}</Text>
            </View>
          </View>
        </View>

        {/* Amount in Words */}
        <Text style={styles.amountWords}>{amountInWords}</Text>

        {/* Notes */}
        {notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>NOTES</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        )}

        {/* Bank Details + QR Code */}
        <View style={styles.bankSection}>
          <View>
            <Text style={styles.bankLabel}>BANK DETAILS</Text>
            <Text style={styles.bankDetail}>Bank: HDFC Bank, Halasuru Branch</Text>
            <Text style={styles.bankDetail}>A/c No: 5020 0090 0123 75</Text>
            <Text style={styles.bankDetail}>IFSC: HDFC0000286</Text>
            <Text style={styles.bankDetail}>UPI: expwave@ybl</Text>
          </View>
          {qrCodeDataUrl && (
            <View style={{ alignItems: "center" }}>
              <Image style={styles.qrCode} src={qrCodeDataUrl} />
              <Text style={styles.qrLabel}>Scan to Pay (UPI)</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
