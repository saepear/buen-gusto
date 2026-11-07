import { redirect } from "next/navigation";
export default async function Anterior({ params }: { params: Promise<{ liquidacionId: string }> }) { redirect('/admin/nomina/pagos/' + encodeURIComponent((await params).liquidacionId) + '/comprobante'); }
