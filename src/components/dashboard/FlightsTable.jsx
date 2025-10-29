import React from 'react';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

export function FlightsTable({ flights }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Flights</CardTitle>
        <CardDescription>
          Flights sorted by optimization score - best deals highlighted
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Airline</TableHead>
              <TableHead>Flight Code</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Stops</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Book Now</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flights.map((flight) => (
              <TableRow
                key={flight.id}
                className={flight.isOptimal ? 'bg-accent/50' : ''}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                    </svg>
                    {flight.airline}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{flight.flightNumber}</span>
                </TableCell>
                <TableCell>{flight.departure}</TableCell>
                <TableCell>{flight.arrival}</TableCell>
                <TableCell>{flight.duration}</TableCell>
                <TableCell>
                  {flight.stops === 0 ? (
                    <Badge variant="secondary">Non-stop</Badge>
                  ) : (
                    <span>{flight.stops} stop{flight.stops > 1 ? 's' : ''}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={flight.isOptimal ? 'font-medium' : ''}>
                      ${flight.price}
                    </span>
                    {flight.isOptimal && (
                      <Badge variant="default" style={{backgroundColor: 'var(--chart-2)', color: 'white'}}>
                        Best Deal
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <a
                    href={flight.bookingLink || `https://www.google.com/search?q=${encodeURIComponent(flight.airline + ' ' + flight.flightNumber + ' booking')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    Book Now
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
