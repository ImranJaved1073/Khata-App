import type { NavigatorScreenParams } from "@react-navigation/native";

import type { CustomerSort } from "../repositories/customerRepository";

export type CustomerBalanceFilter = "receivable" | "payable";

export type CustomersStackParamList = {
  CustomerList: { initialSort?: CustomerSort; balanceFilter?: CustomerBalanceFilter } | undefined;
  CustomerForm: { customerId?: string; initialName?: string } | undefined;
  CustomerKhata: { customerId: string };
  EntryForm: {
    customerId: string;
    entryId?: string;
    mode: "simple" | "bill";
    /** JSON.stringify(BillLineItemState[]) — set when AddItems navigates back with updated items. */
    itemsPayload?: string;
  };
  AddItems: {
    customerId: string;
    entryId?: string;
    /** JSON.stringify(BillLineItemState[]) — the bill's items as committed so far. */
    itemsPayload: string;
    /** Key of the item to open already-active (tapped from the New Bill summary table), if any. */
    activeKey?: string;
  };
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
