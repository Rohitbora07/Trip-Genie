import { z } from "zod";

export const proposalIdParamSchema = z.object({
    id: z.string().trim().uuid("Invalid recovery proposal ID format")
});

export type ProposalIdParams = z.infer<typeof proposalIdParamSchema>;
