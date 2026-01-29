// Inventory Management Types

export type ItemCategory = 'material' | 'part' | 'tool' | 'consumable';
export type UnitType = 'pcs' | 'ml' | 'g' | 'box' | 'kg' | 'l' | 'set';
export type TransactionType = 'in' | 'out' | 'adjust' | 'return' | 'waste';

export interface Supplier {
    id: string;
    lab_id: string;
    name: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    notes: string | null;
}

export interface ItemType {
    id: string;
    lab_id: string;
    name: string;
    category: ItemCategory;
    unit: UnitType;
    min_stock_level: number;
    default_supplier: string | null;
    supplier_id?: string;
    sku: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Computed fields (from joins)
    current_stock?: number;
    total_value?: number;
}

export interface InventoryItem {
    id: string;
    lab_id: string;
    item_type_id: string;
    batch_number: string | null;
    quantity: number;
    unit_cost: number | null;
    total_cost: number | null;
    location: string | null;
    expiry_date: string | null;
    supplier: string | null;
    supplier_id?: string;
    purchase_order: string | null;
    received_at: string;
    notes: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    // Joined fields
    item_type?: ItemType;
}

export interface InventoryTransaction {
    id: string;
    lab_id: string;
    inventory_id: string | null;
    item_type_id: string;
    transaction_type: TransactionType;
    quantity: number;
    quantity_before: number | null;
    quantity_after: number | null;
    unit_cost: number | null;
    related_case_id: string | null;
    reason: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    // Joined fields
    item_type?: ItemType;
    created_by_profile?: {
        full_name: string;
    };
}

export interface LowStockItem {
    item_type_id: string;
    lab_id: string;
    name: string;
    category: ItemCategory;
    unit: UnitType;
    min_stock_level: number;
    current_stock: number;
    shortage: number;
}

export interface InventorySummary {
    total_item_types: number;
    total_stock_value: number;
    low_stock_count: number;
    expiring_soon_count: number;
}

// Form types
export interface CreateItemTypeForm {
    name: string;
    category: ItemCategory;
    unit: UnitType;
    min_stock_level: number;
    default_supplier?: string;
    sku?: string;
    notes?: string;
}

export interface AddInventoryForm {
    item_type_id: string;
    quantity: number;
    unit_cost?: number;
    batch_number?: string;
    location?: string;
    expiry_date?: string;
    supplier?: string;
    purchase_order?: string;
    notes?: string;
}

export interface StockAdjustmentForm {
    item_type_id: string;
    adjustment_type: 'add' | 'remove' | 'set';
    quantity: number;
    reason: string;
    related_case_id?: string;
    notes?: string;
}

// Category and unit labels
export const categoryLabels: Record<ItemCategory, string> = {
    material: 'Material',
    part: 'Part',
    tool: 'Tool',
    consumable: 'Consumable',
};

export const unitLabels: Record<UnitType, string> = {
    pcs: 'Pieces',
    ml: 'Milliliters',
    g: 'Grams',
    box: 'Boxes',
    kg: 'Kilograms',
    l: 'Liters',
    set: 'Sets',
};

export const transactionTypeLabels: Record<TransactionType, string> = {
    in: 'Stock In',
    out: 'Stock Out',
    adjust: 'Adjustment',
    return: 'Return',
    waste: 'Waste/Loss',
};

export const transactionTypeColors: Record<TransactionType, string> = {
    in: 'text-green-600 bg-green-50',
    out: 'text-red-600 bg-red-50',
    adjust: 'text-blue-600 bg-blue-50',
    return: 'text-purple-600 bg-purple-50',
    waste: 'text-orange-600 bg-orange-50',
};
