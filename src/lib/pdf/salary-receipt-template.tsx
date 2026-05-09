import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  companyName: { fontSize: 14, fontWeight: "bold", color: "#1a1a1a" },
  companyDetails: { fontSize: 8, color: "#666", marginTop: 2 },
  receiptTitle: { fontSize: 16, fontWeight: "bold", textAlign: "right" },
  receiptMeta: {
    fontSize: 9,
    color: "#666",
    marginTop: 3,
    textAlign: "right",
  },
  section: {
    backgroundColor: "#f5f5f5",
    padding: 14,
    borderRadius: 4,
    marginTop: 15,
  },
  sectionLabel: {
    fontSize: 7,
    fontWeight: "bold",
    color: "#999",
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  detailLabel: { fontSize: 9, color: "#666", width: "40%" },
  detailValue: { fontSize: 9, fontWeight: "bold", width: "60%" },
  amountSection: {
    marginTop: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 4,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: { fontSize: 11, fontWeight: "bold" },
  amountValue: { fontSize: 14, fontWeight: "bold" },
  amountWords: {
    marginTop: 8,
    fontSize: 8,
    fontStyle: "italic",
    color: "#666",
  },
  footer: {
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    paddingTop: 12,
  },
  footerText: { fontSize: 8, color: "#999", textAlign: "center" },
  signatureSection: {
    marginTop: 50,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signatureBox: { width: "40%", alignItems: "center" },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: "#333",
    width: "100%",
    marginBottom: 4,
  },
  signatureLabel: { fontSize: 8, color: "#666" },
});

interface SalaryReceiptPDFProps {
  employeeName: string;
  employeeNumber: string;
  amount: number;
  paidDate: string;
  paymentMode: string;
  notes: string | null;
  amountInWords: string;
}

function fmtCurrency(n: number) {
  return `\u20B9${n.toLocaleString("en-IN")}`;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function SalaryReceiptPDF({
  employeeName,
  employeeNumber,
  amount,
  paidDate,
  paymentMode,
  notes,
  amountInWords,
}: SalaryReceiptPDFProps) {
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
              PAN: AAHCE9805F
            </Text>
          </View>
          <View>
            <Text style={styles.receiptTitle}>SALARY RECEIPT</Text>
            <Text style={styles.receiptMeta}>Date: {fmtDate(paidDate)}</Text>
          </View>
        </View>

        {/* Employee Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EMPLOYEE DETAILS</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Employee Name</Text>
            <Text style={styles.detailValue}>{employeeName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Employee Number</Text>
            <Text style={styles.detailValue}>{employeeNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Date</Text>
            <Text style={styles.detailValue}>{fmtDate(paidDate)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Mode</Text>
            <Text style={styles.detailValue}>{paymentMode}</Text>
          </View>
          {notes && (
            <View style={{ ...styles.detailRow, borderBottomWidth: 0 }}>
              <Text style={styles.detailLabel}>Notes / Role</Text>
              <Text style={styles.detailValue}>{notes}</Text>
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={styles.amountSection}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Amount Paid</Text>
            <Text style={styles.amountValue}>{fmtCurrency(amount)}</Text>
          </View>
          <Text style={styles.amountWords}>{amountInWords}</Text>
        </View>

        {/* Signature */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Employee Signature</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Authorized Signatory</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a computer-generated salary receipt from Expwave Pvt. Ltd.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
