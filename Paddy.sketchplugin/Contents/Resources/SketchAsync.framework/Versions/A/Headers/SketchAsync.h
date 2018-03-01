//
//  SketchAsync.h
//  SketchAsync
//
//  Created by David Williames on 1/3/18.
//  Copyright © 2018 David Williames. All rights reserved.
//

#import <Cocoa/Cocoa.h>

//! Project version number for SketchAsync.
FOUNDATION_EXPORT double SketchAsyncVersionNumber;

//! Project version string for SketchAsync.
FOUNDATION_EXPORT const unsigned char SketchAsyncVersionString[];

// In this header, you should import all the public headers of your framework using statements like #import <SketchAsync/PublicHeader.h>



@interface SketchAsync : NSObject

- (void)runInBackground:(id)action;

@end
