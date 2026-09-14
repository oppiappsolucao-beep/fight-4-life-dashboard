export interface PlatformPlan {
  id: string;
  name: string;
  billingType: string;
  studentLimit: number;
  price: number;
  active: boolean;
  label: string;
  formaPagamento: string;
}
