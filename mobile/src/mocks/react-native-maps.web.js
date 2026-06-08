const React = require('react');
const { View, Text } = require('react-native');

const MapView = ({ style, children }) =>
  React.createElement(View, { style: [{ backgroundColor: '#e0e7ef', alignItems: 'center', justifyContent: 'center' }, style] },
    React.createElement(Text, { style: { color: '#555', fontSize: 13 } }, '🗺️ Map not available on web'),
    children
  );

MapView.Animated = MapView;

const Marker     = ({ children }) => children ?? null;
const Callout    = ({ children }) => children ?? null;
const Polyline   = () => null;
const Polygon    = () => null;
const Circle     = () => null;

const PROVIDER_DEFAULT = null;
const PROVIDER_GOOGLE  = 'google';

module.exports = MapView;
module.exports.default        = MapView;
module.exports.Marker         = Marker;
module.exports.Callout        = Callout;
module.exports.Polyline       = Polyline;
module.exports.Polygon        = Polygon;
module.exports.Circle         = Circle;
module.exports.PROVIDER_DEFAULT = PROVIDER_DEFAULT;
module.exports.PROVIDER_GOOGLE  = PROVIDER_GOOGLE;
