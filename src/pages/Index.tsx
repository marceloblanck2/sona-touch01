// SØNA Touch 01 - Index Page

import { SonaPad } from '../components/sona/SonaPad';
import { DebugOverlay } from '../components/sona/DebugOverlay';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>SØNA Touch 01 - Touch-Based Sensory Instrument</title>
        <meta name="description" content="SØNA Touch 01 is the first prototype of SØNA — a sensory instrument system built around gesture, color, synesthesia and emotional sound design. Designed and Engineered by Marcelo Blanck." />
      </Helmet>
      <DebugOverlay />
      <SonaPad />
    </>
  );
};

export default Index;
