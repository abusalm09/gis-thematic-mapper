declare module "shapefile" {
  interface Source {
    read(): Promise<{ done: boolean; value: GeoJSON.Feature | null }>;
  }
  export function open(path: string): Promise<Source>;
}
