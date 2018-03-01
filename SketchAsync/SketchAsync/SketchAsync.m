//
//  SketchAsync.m
//  SketchAsync
//
//  Created by James Tang on 23/3/2017.
//  Copyright © 2017 MagicSketch. All rights reserved.
//

#import "SketchAsync.h"

@implementation SketchAsync

- (void)runOnMainThread:(id)action {
    dispatch_async(dispatch_get_main_queue(), ^{
        if([action respondsToSelector:NSSelectorFromString(@"callAction:")]) {
            SEL selector = NSSelectorFromString(@"callAction:");
            ((void (*)(id, SEL))[action methodForSelector:selector])(action, selector);
        }
    });
}

- (void)runOnBackgroundThread:(id)action {
    dispatch_queue_t queue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0ul);
    
    dispatch_async(queue, ^{
        if([action respondsToSelector:NSSelectorFromString(@"callAction:")]) {
            SEL selector = NSSelectorFromString(@"callAction:");
            ((void (*)(id, SEL))[action methodForSelector:selector])(action, selector);
        }
    });
}

@end
