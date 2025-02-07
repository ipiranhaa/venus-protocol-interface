/** @jsxImportSource @emotion/react */
import { useCallback, useMemo } from 'react';

import { Table, type TableProps } from 'components';
import useCollateral from 'hooks/useCollateral';
import { displayMutationError } from 'libs/errors';
import type { Pool } from 'types';

import { routes } from 'constants/routing';
import { useGetChainMetadata } from 'hooks/useGetChainMetadata';
import useOperationModal from 'hooks/useOperationModal';
import { areAddressesEqual } from 'utilities';
import { useStyles } from './styles';
import type { ColumnKey, PoolAsset } from './types';
import useGenerateColumns from './useGenerateColumns';

export interface MarketTableProps
  extends Partial<
    Omit<TableProps<PoolAsset>, 'columns' | 'rowKeyIndex' | 'initialOrder' | 'getRowHref'>
  > {
  pools: Pool[];
  columns: ColumnKey[];
  initialOrder?: {
    orderBy: ColumnKey;
    orderDirection: 'asc' | 'desc';
  };
  openOperationModalOnRowClick?: boolean;
  marketType?: 'supply' | 'borrow';
  className?: string;
  testId?: string;
}

export const MarketTable: React.FC<MarketTableProps> = ({
  pools,
  openOperationModalOnRowClick = false,
  marketType,
  columns: columnKeys,
  initialOrder,
  ...otherTableProps
}) => {
  const styles = useStyles();

  const { corePoolComptrollerContractAddress, stakedEthPoolComptrollerContractAddress } =
    useGetChainMetadata();
  const { toggleCollateral } = useCollateral();
  const { openOperationModal, OperationModal } = useOperationModal();

  const handleCollateralChange = async (poolAssetToUpdate: PoolAsset) => {
    try {
      await toggleCollateral({
        asset: poolAssetToUpdate,
        poolName: poolAssetToUpdate.pool.name,
        comptrollerAddress: poolAssetToUpdate.pool.comptrollerAddress,
      });
    } catch (error) {
      displayMutationError({ error });
    }
  };

  const poolAssets = useMemo(
    () =>
      pools.reduce((acc, pool) => {
        const newPoolAssets: PoolAsset[] = pool.assets.map(asset => ({
          ...asset,
          pool,
        }));

        return acc.concat(newPoolAssets);
      }, [] as PoolAsset[]),
    [pools],
  );

  const columns = useGenerateColumns({
    columnKeys,
    collateralOnChange: handleCollateralChange,
  });

  const formattedInitialOrder = useMemo(() => {
    if (!initialOrder) {
      return undefined;
    }

    const oderByColumn = columns.find(column => column.key === initialOrder.orderBy);

    return (
      oderByColumn && {
        orderBy: oderByColumn,
        orderDirection: initialOrder.orderDirection,
      }
    );
  }, [columns, initialOrder]);

  const getRowHref = useCallback(
    (row: PoolAsset) => {
      if (areAddressesEqual(row.pool.comptrollerAddress, corePoolComptrollerContractAddress)) {
        return routes.corePoolMarket.path.replace(':vTokenAddress', row.vToken.address);
      }

      if (
        stakedEthPoolComptrollerContractAddress &&
        areAddressesEqual(row.pool.comptrollerAddress, stakedEthPoolComptrollerContractAddress)
      ) {
        return routes.stakedEthPoolMarket.path.replace(':vTokenAddress', row.vToken.address);
      }

      return routes.isolatedPoolMarket.path
        .replace(':poolComptrollerAddress', row.pool.comptrollerAddress)
        .replace(':vTokenAddress', row.vToken.address);
    },
    [
      corePoolComptrollerContractAddress,
      stakedEthPoolComptrollerContractAddress,
      stakedEthPoolComptrollerContractAddress,
    ],
  );

  const rowOnClick = useCallback(
    (_: React.MouseEvent<HTMLDivElement>, row: PoolAsset) => {
      const initialActiveTabIndex =
        columnKeys.includes('supplyApyLtv') || columnKeys.includes('labeledSupplyApyLtv') ? 0 : 2;

      openOperationModal({
        vToken: row.vToken,
        poolComptrollerAddress: row.pool.comptrollerAddress,
        initialActiveTabIndex,
      });
    },
    [openOperationModal, columnKeys],
  );

  return (
    <>
      <Table
        getRowHref={openOperationModalOnRowClick ? undefined : getRowHref}
        rowOnClick={openOperationModalOnRowClick ? rowOnClick : undefined}
        columns={columns}
        data={poolAssets}
        css={styles.cardContentGrid}
        rowKeyExtractor={row => `market-table-row-${marketType}-${row.vToken.address}`}
        initialOrder={formattedInitialOrder}
        {...otherTableProps}
      />

      <OperationModal />
    </>
  );
};
