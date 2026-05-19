import { generateTenderPDF } from '../src/lib/_pdf_test.ts';
import { writeFileSync } from 'fs';
const data = {
  title: "Supply of Office Furniture and Fittings",
  documentType: "Quotation",
  tenderNumber: "TND-2026-014",
  quotationRef: "Q-00231",
  clientName: "Department of Public Works",
  clientAddress: "Civic Centre, 12 Hertzog Boulevard\nCape Town\n8001",
  notes: "Pricing valid for 30 days. Delivery within 4-6 weeks of confirmed order.",
  vatInclusive: false,
  vatRate: 15,
  items: Array.from({length: 8}, (_,i)=>({ product: `Executive desk model ${i+1}`, quantity: 2+i, unitPrice: 1250 + i*120 })),
  company: {
    name: "Apex Interiors (Pty) Ltd",
    registration_number: "2018/123456/07",
    vat_number: "4220123456",
    contact_email: "hello@apexinteriors.co.za",
    contact_phone: "+27 21 555 0199",
    address: "Unit 4, Bellview Park\n12 Sir Lowry Road\nWoodstock\nCape Town\n7925",
    website: "www.apexinteriors.co.za",
    primary_color: "#1C382C",
    csd_number: "MAAA0893252",
    bank_name: "Standard Bank",
    bank_account_name: "Apex Interiors (Pty) Ltd",
    bank_account_number: "012 345 6789",
    bank_branch_code: "051001",
    bank_account_type: "Cheque",
  },
};
const blob = await generateTenderPDF(data);
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync('/tmp/sample.pdf', buf);
console.log('wrote', buf.length);
