import { useUser } from "@/lib/providers/user-provider";
export function useDemoSession() { const { extendedUser } = useUser(); return { data: { user: { email: extendedUser?.email } } }; }
