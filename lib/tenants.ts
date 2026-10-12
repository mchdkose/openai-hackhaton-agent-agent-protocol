import roseAndStem from '@/tenants/rose-and-stem/tenant.json';
import petalAtelier from '@/tenants/petal-atelier/tenant.json';
import tulipHouse from '@/tenants/tulip-house/tenant.json';
import type {CatalogOverride,Tenant} from './types';
import {transact} from './store';

const tenants = [roseAndStem, petalAtelier, tulipHouse] as Tenant[];
export const getTenants = (): Tenant[] => tenants.map(t => structuredClone(t));
export const getTenant = (id: string): Tenant | undefined => {
  const tenant = tenants.find(t => t.id === id);
  return tenant ? structuredClone(tenant) : undefined;
};
export function applyCatalogOverride(tenant:Tenant,override?:CatalogOverride):Tenant {
  if(!override)return tenant;
  tenant.catalog.as_of=override.as_of;
  tenant.catalog.products=tenant.catalog.products.map(product=>({...product,...override.products[product.sku]}));
  tenant.catalog.delivery_zones=tenant.catalog.delivery_zones.map(zone=>({...zone,...override.zones[zone.zone]}));
  return tenant;
}
export async function getCurrentTenant(id:string):Promise<Tenant|undefined>{
  const tenant=getTenant(id);if(!tenant)return undefined;
  const override=await transact(state=>structuredClone(state.catalog_overrides[id]));
  return applyCatalogOverride(tenant,override);
}
export async function getCurrentTenants():Promise<Tenant[]>{return Promise.all(getTenants().map(async tenant=>(await getCurrentTenant(tenant.id))!));}
