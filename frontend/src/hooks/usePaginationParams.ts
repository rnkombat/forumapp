import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

type PaginationParams = {
	limit: number;
	offset: number;
};

const ensurePositiveNumber = (value: number, fallback: number) => {
	return Number.isFinite(value) && value > 0 ? value : fallback;
};

const ensureNonNegativeNumber = (value: number, fallback: number) => {
	return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const usePaginationParams = (
	defaultValues: PaginationParams = { limit: 10, offset: 0 }
) => {
	const [searchParams, setSearchParams] = useSearchParams();

	const limit = useMemo(() => {
		const raw = Number(searchParams.get("limit"));
		return ensurePositiveNumber(raw, defaultValues.limit);
	}, [searchParams, defaultValues.limit]);

	const offset = useMemo(() => {
		const raw = Number(searchParams.get("offset"));
		return ensureNonNegativeNumber(raw, defaultValues.offset);
	}, [searchParams, defaultValues.offset]);

	const updateParams = useCallback(
		(next: Partial<PaginationParams>) => {
			const params = new URLSearchParams(searchParams);

			if (next.limit !== undefined) {
				params.set("limit", String(next.limit));
			}

			if (next.offset !== undefined) {
				params.set("offset", String(next.offset));
			}

			setSearchParams(params, { replace: true });
		},
		[searchParams, setSearchParams]
	);

	const setLimit = useCallback(
		(nextLimit: number) => {
			updateParams({ limit: nextLimit, offset: 0 });
		},
		[updateParams]
	);

	const setOffset = useCallback(
		(nextOffset: number) => {
			updateParams({ offset: nextOffset });
		},
		[updateParams]
	);

	return {
		limit,
		offset,
		setLimit,
		setOffset,
	};
};
