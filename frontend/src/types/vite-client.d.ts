declare module "vite/client" {
	export interface ImportMetaEnv {
		readonly VITE_API_URL?: string;
		readonly [key: string]: string | undefined;
	}

	export interface ImportMeta {
		readonly env: ImportMetaEnv;
	}
}
