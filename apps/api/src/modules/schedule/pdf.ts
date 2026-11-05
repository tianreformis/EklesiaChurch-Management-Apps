import { createElement, type ReactElement } from 'react';
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { TenantDb } from '../../db/tenant.js';
import {
  members,
  serviceAssignments,
  serviceRoles,
  services,
} from '../../db/schema/index.js';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, fontFamily: 'Helvetica' },
  churchName: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  serviceBlock: { marginBottom: 10, borderBottom: '1pt solid #ccc', paddingBottom: 6 },
  serviceTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  serviceMeta: { color: '#444', marginBottom: 3 },
  assignmentRow: { flexDirection: 'row', marginLeft: 8 },
  role: { width: 160, fontFamily: 'Helvetica-Bold' },
  member: { flex: 1 },
  empty: { color: '#666', marginLeft: 8 },
  footer: { marginTop: 12, color: '#666' },
});

/**
 * Membuat PDF jadwal pelayanan bulanan di server (siap cetak/ditempel).
 * Ditulis dengan createElement agar modul API tidak butuh JSX.
 */
export async function buildMonthlySchedulePdf(
  tenant: TenantDb,
  churchName: string,
  month: string,
): Promise<Buffer> {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(lastDay).padStart(2, '0')}`;

  const rows = await tenant
    .select()
    .from(services)
    .where(and(gte(services.date, from), lte(services.date, to)))
    .orderBy(asc(services.date), asc(services.startTime));

  const blocks: ReactElement[] = [];
  for (const service of rows) {
    const assignments = await tenant
      .select({ roleName: serviceRoles.name, memberName: members.fullName, status: serviceAssignments.status })
      .from(serviceAssignments)
      .innerJoin(serviceRoles, eq(serviceAssignments.serviceRoleId, serviceRoles.id))
      .innerJoin(members, eq(serviceAssignments.memberId, members.id))
      .where(eq(serviceAssignments.serviceId, service.id))
      .orderBy(asc(serviceRoles.sortOrder), asc(members.fullName));

    const children: ReactElement[] = [
      createElement(Text, { key: 't', style: styles.serviceTitle }, `${service.date} — ${service.title}`),
      createElement(
        Text,
        { key: 'm', style: styles.serviceMeta },
        `${service.startTime}${service.endTime ? `–${service.endTime}` : ''} · ${service.location ?? '-'}${service.preacher ? ` · Pelayan firman: ${service.preacher}` : ''}`,
      ),
    ];
    if (assignments.length === 0) {
      children.push(createElement(Text, { key: 'e', style: styles.empty }, 'Belum ada penugasan.'));
    }
    assignments.forEach((assignment, index) => {
      children.push(
        createElement(
          View,
          { key: `a-${index}`, style: styles.assignmentRow },
          createElement(Text, { style: styles.role }, assignment.roleName),
          createElement(Text, { style: styles.member }, `${assignment.memberName} (${assignment.status})`),
        ),
      );
    });
    blocks.push(createElement(View, { key: service.id, style: styles.serviceBlock }, ...children));
  }

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const document = createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      createElement(Text, { style: styles.churchName }, churchName),
      createElement(Text, { style: styles.title }, `Jadwal Pelayanan — ${monthNames[mon - 1]} ${year}`),
      ...(blocks.length > 0
        ? blocks
        : [createElement(Text, { key: 'none', style: styles.empty }, 'Tidak ada ibadah terjadwal bulan ini.')]),
      createElement(Text, { style: styles.footer }, 'Dibuat oleh Eklesia. Mohon ditempel di papan pengumuman.'),
    ),
  );

  const buffer = await renderToBuffer(document);
  return Buffer.from(buffer);
}
