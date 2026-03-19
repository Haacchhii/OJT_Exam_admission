/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SUPPORT_EMAIL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
