import React from 'react';
import TOC from '@theme-original/TOC';
import type TOCType from '@theme/TOC';
import type {WrapperProps} from '@docusaurus/types';
import { NetworkGraphEmbed } from '../../components/NetworkGraphEmbed';

type Props = WrapperProps<typeof TOCType>;

export default function TOCWrapper(props: Props): React.ReactElement {
  return (
    <div>
      <TOC {...props} />
      <div className="network-graph-sidebar">
        <h4>
          🔗 Page Network
        </h4>
        <NetworkGraphEmbed
          width={240}
          height={200}
          nodeSize={3.5}
          linkDistance={60}
          chargeStrength={-90}
          showLabels={true}
          showTooltips={true}
          showStats={false}
        />
      </div>
    </div>
  );
}
