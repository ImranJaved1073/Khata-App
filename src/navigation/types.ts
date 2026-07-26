import type { NavigatorScreenParams } from "@react-navigation/native";

import type { CustomerSort } from "../repositories/customerRepository";

export type CustomerBalanceFilter = "receivable" | "payable";

export type CustomersStackParamList = {
  CustomerList: { initialSort?: CustomerSort; balanceFilter?: CustomerBalanceFilter } | undefined;
  CustomerForm: { customerId?: string; initialName?: string } | undefined;
  CustomerKhata: { customerId: string };
  EntryForm: { customerId: string; entryId?: string; mode: "simple" | "bill" };
  BillSaved: { entryId: string };
  EntryDetail: { entryId: string };
  EntryHistory: { entryId: string };
};

export type HomeStackParamList = {
  Dashboard: undefined;
};

export type ReportsStackParamList = {
  Reports: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
};

export type RootTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  CustomersTab: NavigatorScreenParams<CustomersStackParamList>;
  ReportsTab: NavigatorScreenParams<ReportsStackParamList>;
  SettingsTab: NavigatorScreenParams<SettingsStackParamList>;
};
