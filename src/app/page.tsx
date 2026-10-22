import Workspace from "@/components/Workspace";
import AuthBridge from "@/components/AuthBridge";
import ProfileProvider from "@/components/ProfileProvider";
import { extensionStoreUrl } from "@/lib/extensionStores";
export const dynamic = "force-dynamic";
export default function Page() {
  const stores = { chrome: extensionStoreUrl("chrome", process.env.MARGIN_CHROME_STORE_URL), firefox: extensionStoreUrl("firefox", process.env.MARGIN_FIREFOX_STORE_URL) };
  return <AuthBridge><ProfileProvider><Workspace extensionStores={stores} /></ProfileProvider></AuthBridge>;
}
