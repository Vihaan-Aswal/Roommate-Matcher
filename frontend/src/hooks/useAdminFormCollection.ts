import { useQuery } from "@tanstack/react-query";

import { getFormStatus, getNonSubmitters } from "../lib/apiClient";
import { adminQueryKeys } from "./adminQueryKeys";

export function useAdminFormStatusQuery() {
  return useQuery({
    queryKey: adminQueryKeys.formStatus,
    queryFn: getFormStatus,
  });
}

export function useAdminNonSubmittersQuery() {
  return useQuery({
    queryKey: adminQueryKeys.nonSubmitters,
    queryFn: getNonSubmitters,
  });
}
