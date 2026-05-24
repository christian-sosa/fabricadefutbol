import Image from "next/image";
import Link from "next/link";

import {
  addClubProductAction,
  deleteClubProductAction,
  updateClubProductAction,
  updateClubSiteSettingsAction,
  uploadClubProductImageAction,
  uploadClubSiteHeroAction
} from "@/app/admin/(panel)/clubs/[clubId]/actions";
import {
  adminContextActionLinkClass,
  adminContextPrimaryActionLinkClass
} from "@/components/admin/admin-context-actions";
import { OptimizedClubSiteImageInput } from "@/components/admin/optimized-club-site-image-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CLUB_SITE_SECTION_KEYS,
  buildClubSitePublicHref,
  type ClubProductRecord,
  type ClubProductStatus
} from "@/lib/domain/club-sites";
import {
  getClubProductImageUrl,
  getClubSiteHeroUrl,
  MAX_CLUB_PRODUCT_IMAGE_SIZE_MB,
  MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB
} from "@/lib/club-site-media";
import type { getAdminClubDetails } from "@/lib/queries/clubs";

const CLUB_SITE_SECTION_LABELS: Record<(typeof CLUB_SITE_SECTION_KEYS)[number], string> = {
  activity: "Actividad reciente",
  catalog: "Catalogo",
  matches: "Ultimos partidos",
  playerStats: "Tabla de jugadores",
  records: "Records",
  teamData: "Datos del equipo",
  teams: "Equipos"
};

const CLUB_PRODUCT_STATUS_OPTIONS: Array<{ label: string; value: ClubProductStatus }> = [
  { label: "Disponible", value: "available" },
  { label: "Preventa", value: "preorder" },
  { label: "Sin stock", value: "sold_out" },
  { label: "Oculto", value: "hidden" }
];

export type SiteProductPanel = "products" | "new" | null;
type ActiveSiteProductPanel = Exclude<SiteProductPanel, null>;
type SiteProductStatusFilter = "all" | ClubProductStatus;

export type SiteProductFilters = {
  category: string;
  search: string;
  status: SiteProductStatusFilter;
};

function getProductStatusLabel(status: string) {
  return CLUB_PRODUCT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Disponible";
}

function getProductStatusClass(status: string) {
  switch (status) {
    case "sold_out":
      return "bg-amber-500/15 text-amber-200";
    case "preorder":
      return "bg-sky-500/15 text-sky-200";
    case "hidden":
      return "bg-slate-700 text-slate-300";
    default:
      return "bg-emerald-500/15 text-emerald-200";
  }
}

export function normalizeSiteProductPanel(panel?: string): SiteProductPanel {
  if (panel === "products") return "products";
  if (panel === "new") return "new";
  return null;
}

export function normalizeSiteProductStatusFilter(status?: string): SiteProductStatusFilter {
  return status === "available" || status === "sold_out" || status === "preorder" || status === "hidden"
    ? status
    : "all";
}

function buildSiteProductPath({
  clubId,
  filters,
  panel
}: {
  clubId: string;
  filters?: Partial<SiteProductFilters>;
  panel: ActiveSiteProductPanel;
}) {
  const searchParams = new URLSearchParams({
    sitePanel: panel,
    tab: "site"
  });
  if (filters?.search?.trim()) searchParams.set("productSearch", filters.search.trim());
  if (filters?.category?.trim()) searchParams.set("productCategory", filters.category.trim());
  if (filters?.status && filters.status !== "all") searchParams.set("productStatus", filters.status);
  return `/admin/clubs/${clubId}?${searchParams.toString()}`;
}

function productMatchesSiteFilters(product: ClubProductRecord, filters: SiteProductFilters) {
  const search = filters.search.trim().toLowerCase();
  const matchesSearch = !search ||
    [product.name, product.category, product.price_label, product.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  const matchesCategory = !filters.category || product.category === filters.category;
  const matchesStatus = filters.status === "all"
    ? true
    : filters.status === "hidden"
      ? !product.visible || product.status === "hidden"
      : product.status === filters.status;

  return matchesSearch && matchesCategory && matchesStatus;
}

function ProductEditor({
  clubId,
  product
}: {
  clubId: string;
  product: ClubProductRecord;
}) {
  const imageUrl = getClubProductImageUrl(product);

  return (
    <details className="group rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <summary className="flex cursor-pointer list-none flex-col gap-4 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-4">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-white">
            {imageUrl ? (
              <Image
                alt={product.name}
                className="h-full w-full object-contain"
                height={112}
                src={imageUrl}
                unoptimized
                width={96}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-semibold text-slate-500">
                Sin imagen
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{product.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {product.category ?? "Sin categoria"} - {getProductStatusLabel(product.status)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={getProductStatusClass(product.status)}>
                {getProductStatusLabel(product.status)}
              </Badge>
              <Badge className={product.visible && product.status !== "hidden" ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-700 text-slate-300"}>
                {product.visible && product.status !== "hidden" ? "Visible" : "Oculto"}
              </Badge>
            </div>
          </div>
        </div>
        <span className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-200 transition group-open:border-emerald-400/60 group-open:text-emerald-300">
          Editar producto
        </span>
      </summary>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <form action={updateClubProductAction.bind(null, clubId)} className="grid gap-3 md:grid-cols-12 md:items-start">
          <input name="productId" type="hidden" value={product.id} />
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-name-${product.id}`}>
              Nombre
            </label>
            <Input defaultValue={product.name} id={`product-name-${product.id}`} name="name" required />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-category-${product.id}`}>
              Categoria
            </label>
            <Input defaultValue={product.category ?? ""} id={`product-category-${product.id}`} name="category" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-price-${product.id}`}>
              Precio
            </label>
            <Input defaultValue={product.price_label ?? ""} id={`product-price-${product.id}`} name="priceLabel" placeholder="Consultar precio" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-status-${product.id}`}>
              Estado
            </label>
            <Select defaultValue={product.status} id={`product-status-${product.id}`} name="status">
              {CLUB_PRODUCT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-order-${product.id}`}>
              Orden en catalogo
            </label>
            <Input defaultValue={product.sort_order} id={`product-order-${product.id}`} min={0} name="sortOrder" type="number" />
            <p className="mt-1 text-xs text-slate-500">Menor numero aparece primero.</p>
          </div>
          <div className="md:col-span-6">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-description-${product.id}`}>
              Descripcion publica
            </label>
            <Textarea defaultValue={product.description ?? ""} id={`product-description-${product.id}`} name="description" rows={3} />
            <p className="mt-1 text-xs text-slate-500">Texto visible en la ficha del producto.</p>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-contact-${product.id}`}>
              Contacto
            </label>
            <Select defaultValue={product.contact_channel} id={`product-contact-${product.id}`} name="contactChannel">
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="custom">Link custom</option>
            </Select>
          </div>
          <div className="md:col-span-4">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-contact-url-${product.id}`}>
              Link de contacto propio
            </label>
            <Input defaultValue={product.contact_url ?? ""} id={`product-contact-url-${product.id}`} name="contactUrl" placeholder="Opcional" />
          </div>
          <div className="md:col-span-6">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-message-${product.id}`}>
              Mensaje de consulta
            </label>
            <Input defaultValue={product.contact_message ?? ""} id={`product-message-${product.id}`} name="contactMessage" placeholder="Opcional: mensaje prearmado para WhatsApp" />
            <p className="mt-1 text-xs text-slate-500">No se muestra en la ficha; se usa al abrir el canal de contacto.</p>
          </div>
          <label className="inline-flex h-11 w-fit items-center gap-2 self-start rounded-md border border-slate-800 bg-slate-900 px-3 text-sm font-semibold text-slate-200 md:col-span-2 md:self-end">
            <input defaultChecked={product.visible} name="visible" type="checkbox" />
            Visible
          </label>
          <div className="md:col-span-4 md:self-end">
            <Button className="h-11" type="submit" variant="secondary">Guardar cambios</Button>
          </div>
        </form>

        <div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <form action={uploadClubProductImageAction.bind(null, clubId)} className="grid gap-2 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-start">
            <input name="productId" type="hidden" value={product.id} />
            <OptimizedClubSiteImageInput
              className="max-w-md"
              helperText={`JPG, PNG o WEBP hasta ${MAX_CLUB_PRODUCT_IMAGE_SIZE_MB} MB. Se optimiza antes de subir.`}
              maxSourceSizeMb={MAX_CLUB_PRODUCT_IMAGE_SIZE_MB}
              name="productImage"
              variant="product"
            />
            <Button className="h-11 w-fit" type="submit" variant="ghost">Subir imagen</Button>
          </form>
          <form action={deleteClubProductAction.bind(null, clubId)} className="flex lg:justify-end">
            <input name="productId" type="hidden" value={product.id} />
            <ConfirmSubmitButton
              className="h-11 w-fit"
              confirmMessage={`Seguro que quieres eliminar ${product.name}?`}
              label="Eliminar"
            />
          </form>
        </div>
      </div>
    </details>
  );
}

export function SiteTab({
  clubId,
  details,
  productFilters,
  productPanel
}: {
  clubId: string;
  details: NonNullable<Awaited<ReturnType<typeof getAdminClubDetails>>>;
  productFilters: SiteProductFilters;
  productPanel: SiteProductPanel;
}) {
  const settings = details.siteSettings;
  const publicHref = buildClubSitePublicHref(details.club, settings);
  const heroUrl = getClubSiteHeroUrl(clubId, settings);
  const productCategories = Array.from(
    new Set(details.products.map((product) => product.category).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right, "es"));
  const filteredProducts = details.products.filter((product) => productMatchesSiteFilters(product, productFilters));
  const activeProductFilters = Boolean(productFilters.search.trim() || productFilters.category || productFilters.status !== "all");

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Sitio del club</CardTitle>
            <CardDescription className="mt-2">
              Configura identidad, contacto, secciones visibles y catalogo. El sitio se publica solo si esta habilitado y publicado.
            </CardDescription>
          </div>
          <a className={adminContextPrimaryActionLinkClass} href={publicHref}>
            Vista del sitio
          </a>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardTitle>Foto principal</CardTitle>
          <CardDescription className="mt-2">
            Esta imagen se usa como cara publica del club. JPG, PNG o WEBP hasta {MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB} MB.
          </CardDescription>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <Image
              alt={`Foto principal de ${details.club.name}`}
              className="aspect-[16/9] w-full object-cover"
              height={675}
              src={heroUrl}
              unoptimized
              width={1200}
            />
          </div>
          <form action={uploadClubSiteHeroAction.bind(null, clubId)} className="mt-4 flex flex-col gap-2">
            <OptimizedClubSiteImageInput
              helperText={`JPG, PNG o WEBP hasta ${MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB} MB. Se prepara en alta calidad antes de subir.`}
              maxSourceSizeMb={MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB}
              name="hero"
              variant="hero"
            />
            <Button className="w-fit" type="submit" variant="secondary">
              Subir foto principal
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Identidad y publicacion</CardTitle>
          <form action={updateClubSiteSettingsAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <input className="mt-1" defaultChecked={settings.enabled} name="enabled" type="checkbox" />
              <span>
                <span className="block font-semibold">Sitio habilitado</span>
                <span className="mt-1 block text-xs text-slate-500">Switch general del sitio del club.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <input className="mt-1" defaultChecked={settings.published} name="published" type="checkbox" />
              <span>
                <span className="block font-semibold">Publicado</span>
                <span className="mt-1 block text-xs text-slate-500">Permite mostrarlo hacia afuera.</span>
              </span>
            </label>
            <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 md:col-span-3">
              Tiene que estar habilitado y publicado para verse en la URL publica y en el listado de clubes.
            </p>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="fontFamily">
                Fuente
              </label>
              <Select defaultValue={settings.fontFamily} id="fontFamily" name="fontFamily">
                <option value="system">Sistema</option>
                <option value="inter">Inter</option>
                <option value="montserrat">Montserrat</option>
                <option value="oswald">Oswald</option>
              </Select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="domain">
                Dominio propio
              </label>
              <Input defaultValue={settings.domain ?? ""} id="domain" name="domain" placeholder="laquinta.com.ar" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="primaryColor">
                Color primario
              </label>
              <Input className="h-11 p-1" defaultValue={settings.primaryColor} id="primaryColor" name="primaryColor" type="color" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="secondaryColor">
                Color secundario
              </label>
              <Input className="h-11 p-1" defaultValue={settings.secondaryColor} id="secondaryColor" name="secondaryColor" type="color" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="accentColor">
                Color contacto
              </label>
              <Input className="h-11 p-1" defaultValue={settings.accentColor} id="accentColor" name="accentColor" type="color" />
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="whatsappUrlOrPhone">
                WhatsApp
              </label>
              <Input defaultValue={settings.whatsappUrlOrPhone ?? ""} id="whatsappUrlOrPhone" name="whatsappUrlOrPhone" placeholder="54911..." />
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="instagramUrl">
                Instagram
              </label>
              <Input defaultValue={settings.instagramUrl ?? ""} id="instagramUrl" name="instagramUrl" placeholder="https://instagram.com/club" />
            </div>
            <div className="md:col-span-3">
              <p className="text-sm font-semibold text-slate-200">Secciones visibles</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CLUB_SITE_SECTION_KEYS.map((key) => (
                  <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200" key={key}>
                    <input defaultChecked={settings.sectionVisibility[key]} name={`section:${key}`} type="checkbox" />
                    {CLUB_SITE_SECTION_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Guardar sitio</Button>
            </div>
          </form>
        </Card>
      </section>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Catalogo del sitio</CardTitle>
            <CardDescription className="mt-2">
              Crea productos solo cuando los necesites y revisa lo cargado con filtros.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className={productPanel === "new" ? adminContextPrimaryActionLinkClass : adminContextActionLinkClass}
              href={buildSiteProductPath({ clubId, panel: "new" })}
            >
              Cargar nuevo producto
            </Link>
            <Link
              className={productPanel === "products" ? adminContextPrimaryActionLinkClass : adminContextActionLinkClass}
              href={buildSiteProductPath({ clubId, filters: productFilters, panel: "products" })}
            >
              Ver productos actuales
            </Link>
          </div>
        </div>
      </Card>

      {productPanel === "new" ? (
        <Card>
          <CardTitle>Nuevo producto</CardTitle>
          <CardDescription className="mt-2">
            El catalogo no vende directo: cada producto deriva a WhatsApp, Instagram o un link custom.
          </CardDescription>
          <form action={addClubProductAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-12 md:items-start">
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-name">
                Nombre
              </label>
              <Input id="new-product-name" name="name" required />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-category">
                Categoria
              </label>
              <Input id="new-product-category" name="category" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-price">
                Precio
              </label>
              <Input id="new-product-price" name="priceLabel" placeholder="Consultar precio" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-status">
                Estado
              </label>
              <Select defaultValue="available" id="new-product-status" name="status">
                {CLUB_PRODUCT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-order">
                Orden en catalogo
              </label>
              <Input defaultValue={details.products.length + 1} id="new-product-order" min={0} name="sortOrder" type="number" />
              <p className="mt-1 text-xs text-slate-500">Menor numero aparece primero.</p>
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-description">
                Descripcion publica
              </label>
              <Textarea id="new-product-description" name="description" rows={3} />
              <p className="mt-1 text-xs text-slate-500">Texto visible en la ficha del producto.</p>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-contact">
                Contacto
              </label>
              <Select defaultValue="whatsapp" id="new-product-contact" name="contactChannel">
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="custom">Link custom</option>
              </Select>
            </div>
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-contact-url">
                Link de contacto propio
              </label>
              <Input id="new-product-contact-url" name="contactUrl" placeholder="Opcional" />
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-message">
                Mensaje de consulta
              </label>
              <Input id="new-product-message" name="contactMessage" placeholder="Opcional: mensaje prearmado para WhatsApp" />
              <p className="mt-1 text-xs text-slate-500">No se muestra en la ficha; se usa al abrir el canal de contacto.</p>
            </div>
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-image">
                Imagen del producto
              </label>
              <OptimizedClubSiteImageInput
                helperText={`Opcional. JPG, PNG o WEBP hasta ${MAX_CLUB_PRODUCT_IMAGE_SIZE_MB} MB. Se optimiza antes de subir.`}
                id="new-product-image"
                maxSourceSizeMb={MAX_CLUB_PRODUCT_IMAGE_SIZE_MB}
                name="productImage"
                variant="product"
              />
            </div>
            <label className="inline-flex h-11 w-fit items-center gap-2 self-start rounded-md border border-slate-800 bg-slate-950 px-3 text-sm font-semibold text-slate-200 md:col-span-2 md:self-end">
              <input defaultChecked name="visible" type="checkbox" />
              Visible
            </label>
            <div className="md:col-span-6 md:self-end">
              <Button className="h-11" type="submit">Crear producto</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {productPanel === "products" ? (
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Productos cargados</CardTitle>
              <CardDescription className="mt-2">
                {filteredProducts.length} de {details.products.length} productos encontrados con los filtros actuales.
              </CardDescription>
            </div>
          </div>

          <form action={`/admin/clubs/${clubId}`} className="mt-4 grid gap-3 md:grid-cols-12 md:items-end">
            <input name="tab" type="hidden" value="site" />
            <input name="sitePanel" type="hidden" value="products" />
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="productSearch">
                Buscar
              </label>
              <Input defaultValue={productFilters.search} id="productSearch" name="productSearch" placeholder="Nombre, categoria o descripcion" />
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="productCategory">
                Categoria
              </label>
              <Select defaultValue={productFilters.category} id="productCategory" name="productCategory">
                <option value="">Todas</option>
                {productCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="productStatus">
                Estado
              </label>
              <Select defaultValue={productFilters.status} id="productStatus" name="productStatus">
                <option value="all">Todos</option>
                {CLUB_PRODUCT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button className="h-11" type="submit" variant="secondary">Filtrar</Button>
              {activeProductFilters ? (
                <Link className={adminContextActionLinkClass} href={buildSiteProductPath({ clubId, panel: "products" })}>
                  Limpiar
                </Link>
              ) : null}
            </div>
          </form>

          <div className="mt-4 space-y-4">
            {filteredProducts.map((product) => (
              <ProductEditor clubId={clubId} key={product.id} product={product} />
            ))}
            {!details.products.length ? (
              <p className="text-sm text-slate-400">Todavia no hay productos. Crea el primero para poblar el catalogo.</p>
            ) : null}
            {details.products.length && !filteredProducts.length ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                No hay productos que coincidan con esos filtros.
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
