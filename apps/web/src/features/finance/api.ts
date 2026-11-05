import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCashAccountInput,
  CreateFinanceCategoryInput,
  CreateTransactionInput,
  SundayOfferingInput,
  TransactionStatus,
  TransactionType,
  UpdateCashAccountInput,
  UpdateFinanceCategoryInput,
  UpdateTransactionInput,
} from '@eklesia/shared';
import { apiClient } from '@/lib/api';
import { toApiError } from '@/lib/http';
import { downloadApiFile } from '@/features/members/api';

export { downloadApiFile };

export interface CashAccountItem {
  id: string;
  name: string;
  openingBalance: number;
  isActive: boolean;
  balance: number;
}

export interface FinanceCategoryItem {
  id: string;
  name: string;
  type: TransactionType;
  isActive: boolean;
}

export interface TransactionItem {
  id: string;
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  date: string;
  description: string | null;
  serviceId: string | null;
  attachmentFile: string | null;
  status: TransactionStatus;
  voidReason: string | null;
  countedBy: string | null;
  verifiedBy: string | null;
  accountName: string;
  categoryName: string;
  createdAt: string;
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  total: number;
}

export interface AccountReport {
  accountId: string;
  name: string;
  openingBalance: number;
  incomeByCategory: CategoryTotal[];
  expenseByCategory: CategoryTotal[];
  totalIncome: number;
  totalExpense: number;
  closingBalance: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  accounts: AccountReport[];
  totalIncome: number;
  totalExpense: number;
}

export interface YearlyReport {
  year: number;
  months: { month: number; totalIncome: number; totalExpense: number }[];
  incomeByCategory: CategoryTotal[];
  expenseByCategory: CategoryTotal[];
  totalIncome: number;
  totalExpense: number;
}

export interface PeriodLockItem {
  id: string;
  year: number;
  month: number;
  lockedAt: string;
}

const FINANCE_KEY = ['finance'] as const;

async function ensureOk(response: Response): Promise<void> {
  if (!response.ok) {
    throw await toApiError(response);
  }
}

export interface TransactionFilterInput {
  page: number;
  perPage: number;
  month?: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
}

export function useAccounts() {
  return useQuery({
    queryKey: [...FINANCE_KEY, 'accounts'],
    queryFn: async (): Promise<CashAccountItem[]> => {
      const response = await apiClient.api.finance.accounts.$get();
      await ensureOk(response);
      return ((await response.json()) as { items: CashAccountItem[] }).items;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: [...FINANCE_KEY, 'categories'],
    queryFn: async (): Promise<FinanceCategoryItem[]> => {
      const response = await apiClient.api.finance.categories.$get();
      await ensureOk(response);
      return ((await response.json()) as { items: FinanceCategoryItem[] }).items;
    },
  });
}

export function useTransactions(filter: TransactionFilterInput) {
  return useQuery({
    queryKey: [...FINANCE_KEY, 'transactions', filter],
    queryFn: async () => {
      const query: Record<string, string> = {
        page: String(filter.page),
        perPage: String(filter.perPage),
      };
      if (filter.month) query.month = filter.month;
      if (filter.accountId) query.accountId = filter.accountId;
      if (filter.categoryId) query.categoryId = filter.categoryId;
      if (filter.type) query.type = filter.type;
      if (filter.status) query.status = filter.status;
      const response = await apiClient.api.finance.transactions.$get({ query });
      await ensureOk(response);
      return (await response.json()) as {
        items: TransactionItem[];
        meta: { page: number; perPage: number; total: number; totalPages: number };
      };
    },
  });
}

export function usePeriodLocks() {
  return useQuery({
    queryKey: [...FINANCE_KEY, 'period-locks'],
    queryFn: async (): Promise<PeriodLockItem[]> => {
      const response = await apiClient.api.finance['period-locks'].$get();
      await ensureOk(response);
      return ((await response.json()) as { items: PeriodLockItem[] }).items;
    },
  });
}

export function useMonthlyReport(year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: [...FINANCE_KEY, 'report', year, month],
    enabled,
    queryFn: async (): Promise<MonthlyReport> => {
      const response = await apiClient.api.finance.reports.monthly.$get({
        query: { year: String(year), month: String(month) },
      });
      await ensureOk(response);
      return (await response.json()) as MonthlyReport;
    },
  });
}

export function useYearlyReport(year: number, enabled = true) {
  return useQuery({
    queryKey: [...FINANCE_KEY, 'report-year', year],
    enabled,
    queryFn: async (): Promise<YearlyReport> => {
      const response = await apiClient.api.finance.reports.yearly.$get({
        query: { year: String(year) },
      });
      await ensureOk(response);
      return (await response.json()) as YearlyReport;
    },
  });
}

function useInvalidating<TInput, TOutput>(fn: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: FINANCE_KEY }),
  });
}

export function useCreateTransaction() {
  return useInvalidating(async (input: CreateTransactionInput) => {
    const response = await apiClient.api.finance.transactions.$post({ json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useUpdateTransaction() {
  return useInvalidating(async ({ id, input }: { id: string; input: UpdateTransactionInput }) => {
    const response = await apiClient.api.finance.transactions[':id'].$patch({ param: { id }, json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useVoidTransaction() {
  return useInvalidating(async ({ id, reason }: { id: string; reason: string }) => {
    const response = await apiClient.api.finance.transactions[':id'].void.$post({
      param: { id },
      json: { reason },
    });
    await ensureOk(response);
    return response.json();
  });
}

export function useCreateOffering() {
  return useInvalidating(async (input: SundayOfferingInput) => {
    const response = await apiClient.api.finance.offerings.$post({ json: input });
    await ensureOk(response);
    return (await response.json()) as { items: unknown[]; total: number };
  });
}

export function useCreateAccount() {
  return useInvalidating(async (input: CreateCashAccountInput) => {
    const response = await apiClient.api.finance.accounts.$post({ json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useUpdateAccount() {
  return useInvalidating(async ({ id, input }: { id: string; input: UpdateCashAccountInput }) => {
    const response = await apiClient.api.finance.accounts[':id'].$patch({ param: { id }, json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useCreateCategory() {
  return useInvalidating(async (input: CreateFinanceCategoryInput) => {
    const response = await apiClient.api.finance.categories.$post({ json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useUpdateCategory() {
  return useInvalidating(async ({ id, input }: { id: string; input: UpdateFinanceCategoryInput }) => {
    const response = await apiClient.api.finance.categories[':id'].$patch({ param: { id }, json: input });
    await ensureOk(response);
    return response.json();
  });
}

export function useLockPeriod() {
  return useInvalidating(async ({ year, month }: { year: number; month: number }) => {
    const response = await apiClient.api.finance['period-locks'].$post({ json: { year, month } });
    await ensureOk(response);
    return response.json();
  });
}

export function useUnlockPeriod() {
  return useInvalidating(async ({ year, month }: { year: number; month: number }) => {
    const response = await apiClient.api.finance['period-locks'][':year'][':month'].$delete({
      param: { year: String(year), month: String(month) },
    });
    await ensureOk(response);
    return response.json();
  });
}

export async function uploadAttachment(transactionId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`/api/finance/transactions/${transactionId}/attachment`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  await ensureOk(response);
}
